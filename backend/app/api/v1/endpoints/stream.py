from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json
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

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        from app.engines.llm.router import llm_router # Lazy import to avoid circular dependency with pipeline if any
        
        while True:
            data = await websocket.receive_text()
            
            # Assume data is a JSON string or plain text
            # If JSON, parse it.
            try:
                message = json.loads(data)
                query = message.get("query")
            except:
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
        await manager.broadcast_json({"type": "status", "data": "Client left"})
