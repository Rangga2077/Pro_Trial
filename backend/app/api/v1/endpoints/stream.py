from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio
# Import router locally inside endpoint to avoid circular import if needed, 
# but better to import at top if possible. 
# However, stream.py is imported by pipeline.py, and pipeline might be used by main.
# To be safe, we'll do a lazy import or ensure clean architecture.
# For now, let's import at top, if it fails we fix.

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    async def broadcast_json(self, data: dict):
        for connection in self.active_connections:
            await connection.send_json(data)

manager = ConnectionManager()

@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    print("WS: Connection attempt...")
    await manager.connect(websocket)
    print("WS: Client connected")
    print("WS: Client connected")
    try:
        from app.engines.llm.router import llm_router # Lazy import to avoid circular dependency with pipeline if any

        while True:
            # Use a short timeout so the event loop is free to run broadcast_json
            # from the CV pipeline concurrently (Starlette cannot send+receive in
            # parallel on the same socket from different coroutines if one blocks)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.05)
            except asyncio.TimeoutError:
                # No message from client this tick — perfectly normal.
                continue

            # Assume data is a JSON string or plain text
            try:
                message = json.loads(data)
                query = message.get("query")
            except Exception:
                query = data

            if query:
                response = await llm_router.route_query(query)
                await manager.broadcast_json({
                    "type": "llm_response",
                    "data": {
                        "query": query,
                        "response": response
                    }
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("WS: Client disconnected")
        await manager.broadcast_json({"type": "status", "data": "Client left"})
    except Exception as e:
        print(f"WS Error: {e}")
        import traceback
        traceback.print_exc()
        manager.disconnect(websocket)
