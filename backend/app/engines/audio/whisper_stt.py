"""Free-speech transcription for Ask Jenny (faster-whisper on the CPU, int8).

`faster_whisper` and `numpy` are imported lazily so the rest of the app (and
the test suite) runs without them. The options match the "Ask Jenny"
benchmark (`backend/scripts/benchmark_assistant.py`).
"""

from typing import Protocol


class Transcriber(Protocol):
    def transcribe(self, pcm: bytes, initial_prompt: str | None = None, hotwords: str | None = None) -> str:
        """16 kHz mono int16 PCM → text ("" when nothing was said)."""
        ...


class WhisperTranscriber:
    def __init__(self, model_name: str):
        from faster_whisper import WhisperModel

        self._model = WhisperModel(model_name, device="cpu", compute_type="int8")

    def transcribe(self, pcm: bytes, initial_prompt: str | None = None, hotwords: str | None = None) -> str:
        import numpy as np

        # Samples instead of a file path: skips faster-whisper's PyAV decoder.
        samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
        segments, _info = self._model.transcribe(
            samples,
            language="en",
            vad_filter=True,
            beam_size=1,
            initial_prompt=initial_prompt,
            hotwords=hotwords,
        )
        return " ".join(segment.text.strip() for segment in segments).strip()
