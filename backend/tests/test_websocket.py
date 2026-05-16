from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.endpoints import stream


def test_websocket_accepts_connection_and_reports_invalid_payload():
    app = FastAPI()
    app.include_router(stream.router, prefix="/ws")
    client = TestClient(app)

    with client.websocket_connect("/ws/") as websocket:
        websocket.send_text("not-json")
        message = websocket.receive_json()

    assert message == {
        "type": "status",
        "data": {"message": "Invalid WebSocket message"},
    }
