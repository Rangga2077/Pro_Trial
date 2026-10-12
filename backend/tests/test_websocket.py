from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import stream
from app.engines.audio.pipeline import voice_pipeline


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(stream.router, prefix="/ws")
    return TestClient(app)


def test_websocket_sends_voice_status_on_connect():
    with make_client().websocket_connect("/ws/") as websocket:
        message = websocket.receive_json()

    assert message == {"type": "voice_status", "data": {"state": "disabled", "message": None}}


def test_websocket_accepts_connection_and_reports_invalid_payload():
    with make_client().websocket_connect("/ws/") as websocket:
        websocket.receive_json()  # voice_status
        websocket.send_text("not-json")
        message = websocket.receive_json()

    assert message == {
        "type": "status",
        "data": {"message": "Invalid WebSocket message"},
    }


def test_websocket_ui_mode_sets_voice_screen():
    interpreter = voice_pipeline.interpreter
    previous_mode = interpreter.mode
    try:
        with make_client().websocket_connect("/ws/") as websocket:
            websocket.receive_json()  # voice_status
            websocket.send_json({"type": "ui_mode", "mode": "cooking"})
            # An invalid message after it proves the ui_mode was consumed silently.
            websocket.send_json({"type": "ui_mode", "mode": "not-a-screen"})
            message = websocket.receive_json()

        assert interpreter.mode == "cooking"
        assert message == {"type": "status", "data": {"message": "Invalid WebSocket message"}}
    finally:
        interpreter.set_mode(previous_mode)
