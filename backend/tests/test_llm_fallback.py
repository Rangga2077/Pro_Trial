"""Ask Jenny keeps working when the LLM is not available (SDD 3.6 and 3.8)."""

import asyncio

from app.engines.llm.client import LLMClient
from app.services.jenny import ERROR_MESSAGE, JennyService

# Nothing listens on port 9 ("discard") on a normal machine, so the request fails fast.
NO_SERVER = "http://127.0.0.1:9"


class HeardTranscriber:
    def transcribe(self, pcm: bytes, initial_prompt: str | None = None, hotwords: str | None = None) -> str:
        return "What does al dente mean?"


def test_chat_returns_the_fallback_answer_when_ollama_is_not_running():
    answer = asyncio.run(LLMClient(base_url=NO_SERVER).chat([{"role": "user", "content": "Hello"}]))

    assert answer == "Sorry, I can't answer right now. Is Ollama running?"


def test_generate_returns_the_fallback_answer_when_ollama_is_not_running():
    answer = asyncio.run(LLMClient(base_url=NO_SERVER).generate("Hello"))

    assert answer == "I'm sorry, I couldn't process that."


def test_an_llm_error_returns_jenny_to_idle_with_a_message():
    sent: list[dict] = []

    async def broadcast(message):
        sent.append(message.model_dump(mode="json"))

    async def broken_chat(messages, options):
        raise RuntimeError("connection lost")

    service = JennyService(
        transcriber_factory=HeardTranscriber,
        chat=broken_chat,
        broadcast=broadcast,
        load_recipe=lambda recipe_id: None,
        warm_up=False,
    )

    async def run():
        await service.load()
        await service.start_listening()
        await service.answer_audio(b"\x00\x00")

    asyncio.run(run())

    assert sent[-1] == {"type": "jenny_status", "data": {"state": "idle", "transcript": None, "message": ERROR_MESSAGE}}
    assert service.can_listen()  # the next "Hello Jenny" works again
