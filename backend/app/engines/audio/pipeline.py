"""Voice pipeline: microphone → Vosk → VoiceActionInterpreter → WebSocket.

Recognition runs in a worker thread so the asyncio loop (and the CV
pipeline) is never blocked. A missing microphone or model reports a
`voice_status: error` instead of crashing the app.
"""

import asyncio
from collections.abc import Awaitable, Callable

from app.core.config import settings
from app.schemas.contracts import (
    GestureAction,
    VoiceCommandData,
    VoiceCommandMessage,
    VoiceState,
    VoiceStatusData,
    VoiceStatusMessage,
)
from app.services.realtime import realtime_service
from app.services.voice_actions import VoiceActionInterpreter, all_phrases, voice_action_interpreter


class VoicePipeline:
    READ_TIMEOUT_SECONDS = 0.2

    def __init__(
        self,
        interpreter: VoiceActionInterpreter = voice_action_interpreter,
        broadcast: Callable[[VoiceCommandMessage | VoiceStatusMessage], Awaitable[None]] = realtime_service.broadcast,
    ):
        self.interpreter = interpreter
        self._broadcast = broadcast
        # "listening" is only reported once the model and microphone are open.
        self.state: VoiceState = "disabled"
        self.message: str | None = None
        self.running = False

    def status_message(self) -> VoiceStatusMessage:
        return VoiceStatusMessage(data=VoiceStatusData(state=self.state, message=self.message))

    async def set_status(self, state: VoiceState, message: str | None = None) -> None:
        self.state, self.message = state, message
        await self._broadcast(self.status_message())

    async def handle_transcript(self, transcript: str, confidence: float) -> GestureAction:
        """Interpret one recognized phrase and broadcast it if it maps to an action."""
        action = self.interpreter.interpret(transcript, confidence)
        if action != GestureAction.NO_ACTION:
            await self._broadcast(VoiceCommandMessage(
                data=VoiceCommandData(action=action, transcript=transcript, confidence=round(confidence, 3)),
            ))
        return action

    async def start(self) -> None:
        loop = asyncio.get_running_loop()
        try:
            from app.engines.audio.stt import MicrophoneStream, VoskEngine

            engine = await asyncio.to_thread(
                VoskEngine, settings.VOICE_MODEL_PATH, all_phrases(), settings.VOICE_SAMPLE_RATE,
            )
            microphone = MicrophoneStream(settings.VOICE_SAMPLE_RATE, settings.VOICE_DEVICE_INDEX)
        except Exception as error:  # missing package, model or microphone
            print(f"Voice pipeline unavailable: {error}")
            await self.set_status("error", str(error))
            return

        self.running = True
        await self.set_status("listening")
        print(f"Voice pipeline listening (model: {settings.VOICE_MODEL_PATH.name})")

        def recognize() -> None:
            with microphone:
                while self.running:
                    pcm = microphone.read(self.READ_TIMEOUT_SECONDS)
                    if pcm is None:
                        continue
                    result = engine.accept(pcm)
                    if result is not None:
                        asyncio.run_coroutine_threadsafe(self.handle_transcript(*result), loop)

        try:
            await asyncio.to_thread(recognize)
        except Exception as error:
            print(f"Voice pipeline stopped: {error}")
            await self.set_status("error", str(error))

    def stop(self) -> None:
        self.running = False


voice_pipeline = VoicePipeline()
