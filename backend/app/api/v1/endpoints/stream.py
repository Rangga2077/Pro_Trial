import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.engines.audio.pipeline import voice_pipeline
from app.schemas.contracts import (
    LLMQueryMessage,
    LLMResponseData,
    LLMResponseMessage,
    StatusData,
    StatusMessage,
    UIModeMessage,
)
from app.services.gesture_actions import gesture_action_interpreter
from app.services.realtime import realtime_service

router = APIRouter()


@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    print("WS: Connection attempt...")
    await realtime_service.connect(websocket)
    print("WS: Client connected")
    await websocket.send_json(voice_pipeline.status_message().model_dump(mode="json"))

    try:
        from app.engines.llm.router import llm_router

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.05)
            except asyncio.TimeoutError:
                continue

            try:
                payload = json.loads(data)
                if isinstance(payload, dict) and payload.get("type") == "ui_mode":
                    # The HUD screen changed (by gesture, voice or click): voice
                    # phrases and gestures both map per screen.
                    mode = UIModeMessage(**payload).mode
                    voice_pipeline.interpreter.set_mode(mode)
                    gesture_action_interpreter.set_mode(mode)
                    continue
                message = LLMQueryMessage(**payload)
            except (json.JSONDecodeError, TypeError, ValidationError):
                await websocket.send_json(
                    StatusMessage(data=StatusData(message="Invalid WebSocket message")).model_dump(mode="json")
                )
                continue

            response = await llm_router.route_query(message.query)
            await realtime_service.broadcast(
                LLMResponseMessage(data=LLMResponseData(query=message.query, response=response))
            )

    except WebSocketDisconnect:
        realtime_service.disconnect(websocket)
        print("WS: Client disconnected")
        await realtime_service.broadcast(StatusMessage(data=StatusData(message="Client left")))
    except Exception as e:
        print(f"WS Error: {e}")
        import traceback

        traceback.print_exc()
        realtime_service.disconnect(websocket)
