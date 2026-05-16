from typing import Any

from fastapi import WebSocket
from pydantic import BaseModel


class RealtimeService:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: BaseModel | dict[str, Any]):
        payload = message.model_dump(mode="json") if isinstance(message, BaseModel) else message
        stale_connections: list[WebSocket] = []

        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(connection)


realtime_service = RealtimeService()
