"""Voice pipeline: microphone → Vosk → VoiceActionInterpreter → WebSocket.

Recognition runs in a worker thread so the asyncio loop (and the CV
pipeline) is never blocked. A missing microphone or model reports a
`voice_status: error` instead of crashing the app.

"hello jenny" (session 2) switches the same microphone stream to Jenny for
JENNY_LISTEN_SECONDS: those chunks skip Vosk, so the question can't trigger
commands, and go to `JennyService.answer_audio` as one recording.
"""

import asyncio
import threading
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
from app.services.jenny import JennyService, jenny_service
from app.services.realtime import realtime_service
from app.services.voice_actions import VoiceActionInterpreter, all_phrases, voice_action_interpreter


class VoicePipeline:
    READ_TIMEOUT_SECONDS = 0.2

    def __init__(
        self,
        interpreter: VoiceActionInterpreter = voice_action_interpreter,
        broadcast: Callable[[VoiceCommandMessage | VoiceStatusMessage], Awaitable[None]] = realtime_service.broadcast,
        jenny: JennyService = jenny_service,
    ):
        self.interpreter = interpreter
        self._broadcast = broadcast
        self.jenny = jenny
        # "listening" is only reported once the model and microphone are open.
        self.state: VoiceState = "disabled"
        self.message: str | None = None
        self.running = False
        # Set while the microphone feeds Jenny instead of Vosk.
        self._capture = threading.Event()
        self._capture_chunks: list[bytes] = []
        self._capture_bytes = int(settings.JENNY_LISTEN_SECONDS * settings.VOICE_SAMPLE_RATE) * 2  # int16
        self._jenny_load: asyncio.Task | None = None

    def status_message(self) -> VoiceStatusMessage:
        return VoiceStatusMessage(data=VoiceStatusData(state=self.state, message=self.message))

    async def set_status(self, state: VoiceState, message: str | None = None) -> None:
        self.state, self.message = state, message
        await self._broadcast(self.status_message())

    async def handle_transcript(self, transcript: str, confidence: float) -> GestureAction:
        """Interpret one recognized phrase and broadcast it if it maps to an action."""
        action = self.interpreter.interpret(transcript, confidence)
        if action == GestureAction.ASK_JENNY and self.jenny.can_listen():
            self._capture_chunks.clear()
            self._capture.set()
            await self.jenny.start_listening()
        if action != GestureAction.NO_ACTION:
            await self._broadcast(VoiceCommandMessage(
                data=VoiceCommandData(action=action, transcript=transcript, confidence=round(confidence, 3)),
            ))
        return action

    def collect_capture(self, pcm: bytes) -> bytes | None:
        """Gather microphone chunks for Jenny; return the recording once the window is full."""
        self._capture_chunks.append(pcm)
        if sum(len(chunk) for chunk in self._capture_chunks) < self._capture_bytes:
            return None
        audio = b"".join(self._capture_chunks)[: self._capture_bytes]
        self._capture_chunks.clear()
        return audio

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
        if settings.JENNY_ENABLED:
            # Loads the speech model alongside; commands work meanwhile.
            self._jenny_load = asyncio.create_task(self.jenny.load())

        def recognize() -> None:
            with microphone:
                while self.running:
                    pcm = microphone.read(self.READ_TIMEOUT_SECONDS)
                    if pcm is None:
                        continue
                    if self._capture.is_set():
                        audio = self.collect_capture(pcm)
                        if audio is not None:
                            self._capture.clear()
                            engine.reset()
                            asyncio.run_coroutine_threadsafe(self.jenny.answer_audio(audio), loop)
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
