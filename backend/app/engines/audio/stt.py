"""Offline speech recognition for voice commands.

`vosk` and `sounddevice` are imported lazily so the rest of the app (and the
test suite) runs without them installed.
"""

import json
import queue
from pathlib import Path
from typing import Protocol


class SpeechEngine(Protocol):
    def accept(self, pcm: bytes) -> tuple[str, float] | None:
        """Feed 16-bit mono PCM; return (transcript, confidence) when a phrase ends."""
        ...

    def reset(self) -> None:
        """Forget any partial phrase."""
        ...


class VoskEngine:
    """Vosk recognizer restricted to the command phrases (plus `[unk]` for
    everything else), which keeps false matches low and recognition fast."""

    def __init__(self, model_path: Path, phrases: list[str], sample_rate: int):
        from vosk import KaldiRecognizer, Model, SetLogLevel

        if not Path(model_path).is_dir():
            raise FileNotFoundError(f"Vosk model not found at {model_path}")

        SetLogLevel(-1)
        self._recognizer = KaldiRecognizer(Model(str(model_path)), sample_rate, json.dumps([*phrases, "[unk]"]))
        self._recognizer.SetWords(True)

    def accept(self, pcm: bytes) -> tuple[str, float] | None:
        if not self._recognizer.AcceptWaveform(pcm):
            return None

        result = json.loads(self._recognizer.Result())
        text = result.get("text", "").strip()
        words = result.get("result", [])
        if not text or not words:
            return None

        confidence = sum(word.get("conf", 0.0) for word in words) / len(words)
        return text, confidence

    def reset(self) -> None:
        """Drop any half-heard phrase (after audio was routed elsewhere, e.g. to Jenny)."""
        self._recognizer.Reset()


class MicrophoneStream:
    """16 kHz mono int16 microphone capture; the audio callback fills a queue."""

    BLOCK_SECONDS = 0.1

    def __init__(self, sample_rate: int, device: int | None = None):
        import sounddevice

        self._chunks: queue.Queue[bytes] = queue.Queue()
        self._stream = sounddevice.RawInputStream(
            samplerate=sample_rate,
            blocksize=int(sample_rate * self.BLOCK_SECONDS),
            dtype="int16",
            channels=1,
            device=device,
            callback=self._on_audio,
        )

    def _on_audio(self, data, frames, time_info, status) -> None:
        self._chunks.put(bytes(data))

    def read(self, timeout: float) -> bytes | None:
        try:
            return self._chunks.get(timeout=timeout)
        except queue.Empty:
            return None

    def __enter__(self) -> "MicrophoneStream":
        self._stream.start()
        return self

    def __exit__(self, *exc) -> None:
        self._stream.stop()
        self._stream.close()
