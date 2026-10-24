import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import stream
from app.engines.audio.pipeline import voice_pipeline
from app.engines.llm import router as router_module
from app.services.gesture_actions import gesture_action_interpreter
from app.services.jenny import jenny_service


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(stream.router, prefix="/ws")
    return TestClient(app)


def test_websocket_sends_voice_and_jenny_status_on_connect():
    with make_client().websocket_connect("/ws/") as websocket:
        voice = websocket.receive_json()
        jenny = websocket.receive_json()

    assert voice == {"type": "voice_status", "data": {"state": "disabled", "message": None}}
    assert jenny["type"] == "jenny_status"
    assert jenny["data"]["state"] == "unavailable"


def test_websocket_accepts_connection_and_reports_invalid_payload():
    with make_client().websocket_connect("/ws/") as websocket:
        websocket.receive_json()  # voice_status
        websocket.receive_json()  # jenny_status
        websocket.send_text("not-json")
        message = websocket.receive_json()

    assert message == {
        "type": "status",
        "data": {"message": "Invalid WebSocket message"},
    }


def test_websocket_ui_mode_sets_voice_screen():
    interpreter = voice_pipeline.interpreter
    previous_mode = interpreter.mode
    previous_gesture_mode = gesture_action_interpreter.mode
    previous_recipe = jenny_service.recipe_id
    try:
        with make_client().websocket_connect("/ws/") as websocket:
            websocket.receive_json()  # voice_status
            websocket.receive_json()  # jenny_status
            websocket.send_json({"type": "ui_mode", "mode": "cooking", "recipe_id": "fried_rice"})
            # An invalid message after it proves the ui_mode was consumed silently.
            websocket.send_json({"type": "ui_mode", "mode": "not-a-screen"})
            message = websocket.receive_json()

        assert interpreter.mode == "cooking"
        # Gestures follow the screen too (it may change by voice or click).
        assert gesture_action_interpreter.mode == "cooking"
        # Jenny answers about the open recipe.
        assert jenny_service.recipe_id == "fried_rice"
        assert message == {"type": "status", "data": {"message": "Invalid WebSocket message"}}
    finally:
        interpreter.set_mode(previous_mode)
        gesture_action_interpreter.set_mode(previous_gesture_mode)
        jenny_service.set_recipe(previous_recipe)


def test_slow_llm_query_does_not_block_later_messages(monkeypatch):
    async def slow_route_query(query: str) -> str:
        await asyncio.sleep(0.5)
        return f"answer to {query}"

    monkeypatch.setattr(router_module.llm_router, "route_query", slow_route_query)

    with make_client().websocket_connect("/ws/") as websocket:
        websocket.receive_json()  # voice_status
        websocket.receive_json()  # jenny_status
        websocket.send_json({"type": "llm_query", "query": "substitute for ham?"})
        websocket.send_text("not-json")
        first = websocket.receive_json()
        second = websocket.receive_json()

    # The invalid message is handled while the LLM is still thinking.
    assert first == {"type": "status", "data": {"message": "Invalid WebSocket message"}}
    assert second == {"type": "llm_response", "data": {"query": "substitute for ham?", "response": "answer to substitute for ham?"}}
