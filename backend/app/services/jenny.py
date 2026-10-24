"""Ask Jenny: one spoken question → faster-whisper → local LLM → HUD.

The voice pipeline records the question after "hello jenny" and hands the PCM
to `answer_audio`. The HUD follows along through `jenny_status`
(listening → thinking → idle) and receives the answer as `llm_response`.
Transcriber, chat and broadcast are injected so tests use fakes.
"""

import asyncio
from collections.abc import Awaitable, Callable

from pydantic import BaseModel

from app.core.config import settings
from app.engines.audio.whisper_stt import Transcriber
from app.schemas.contracts import (
    JennyState,
    JennyStatusData,
    JennyStatusMessage,
    LLMResponseData,
    LLMResponseMessage,
)
from app.schemas.recipe import Recipe
from app.services.realtime import realtime_service
from app.services.recipe_loader import recipe_loader

SYSTEM_PROMPT = (
    "You are Jenny, a kitchen assistant. Answer in at most 40 words, plain English, "
    "no lists. If the question is not about cooking, say you can only help with cooking."
)
# Whisper initial prompt: biases recognition toward cooking words.
COOKING_PROMPT = (
    "Cooking questions: stir-fry, al dente, tablespoon, teaspoon, cornstarch slurry, "
    "dumplings, simmer, marinate, wok, substitute, instead of."
)
NOT_HEARD_MESSAGE = 'Didn\'t catch that. Say "Hello Jenny" and try again.'
ERROR_MESSAGE = "Sorry, something went wrong. Try again."
WHISPER_SAMPLE_RATE = 16000

ChatFn = Callable[[list[dict[str, str]], dict], Awaitable[str]]


def format_amount(amount: float) -> str:
    return f"{amount:g}"


def build_messages(question: str, recipe: Recipe | None) -> list[dict[str, str]]:
    system = SYSTEM_PROMPT
    if recipe is not None:
        ingredients = "; ".join(f"{i.name} {format_amount(i.amount)} {i.unit}".strip() for i in recipe.ingredients)
        system += f"\nRecipe: {recipe.title}\nIngredients: {ingredients}"
    return [{"role": "system", "content": system}, {"role": "user", "content": question}]


def hotwords(recipe: Recipe) -> str:
    """Recipe title and ingredient names, so Whisper hears them more reliably."""
    return ", ".join([recipe.title, *(i.name for i in recipe.ingredients)])


def llm_options() -> dict:
    return {
        "num_ctx": settings.JENNY_NUM_CTX,
        "num_predict": settings.JENNY_NUM_PREDICT,
        "temperature": settings.JENNY_TEMPERATURE,
    }


def default_transcriber() -> Transcriber:
    from app.engines.audio.whisper_stt import WhisperTranscriber

    return WhisperTranscriber(settings.JENNY_STT_MODEL)


async def default_chat(messages: list[dict[str, str]], options: dict) -> str:
    from app.engines.llm.client import llm_client

    return await llm_client.chat(messages, options)


class JennyService:
    def __init__(
        self,
        transcriber_factory: Callable[[], Transcriber] = default_transcriber,
        chat: ChatFn = default_chat,
        broadcast: Callable[[BaseModel], Awaitable[None]] = realtime_service.broadcast,
        load_recipe: Callable[[str], Recipe | None] = recipe_loader.load_recipe,
        warm_up: bool = True,
    ):
        self._transcriber_factory = transcriber_factory
        self._chat = chat
        self._warm_up = warm_up
        self._broadcast = broadcast
        self._load_recipe = load_recipe
        self._transcriber: Transcriber | None = None
        self.recipe_id: str | None = None
        self.busy = False
        self.state: JennyState = "unavailable"
        self.message: str | None = "Needs VOICE_ENABLED and JENNY_ENABLED"

    def status_message(self) -> JennyStatusMessage:
        return JennyStatusMessage(data=JennyStatusData(state=self.state, message=self.message))

    async def _set_status(self, state: JennyState, transcript: str | None = None, message: str | None = None) -> None:
        self.state, self.message = state, message
        await self._broadcast(JennyStatusMessage(
            data=JennyStatusData(state=state, transcript=transcript, message=message),
        ))

    def set_recipe(self, recipe_id: str | None) -> None:
        self.recipe_id = recipe_id

    async def load(self) -> None:
        """Load the speech model in a worker thread. Failure leaves Jenny unavailable;
        voice commands keep working."""
        if settings.VOICE_SAMPLE_RATE != WHISPER_SAMPLE_RATE:
            await self._set_status("unavailable", message=f"Needs VOICE_SAMPLE_RATE={WHISPER_SAMPLE_RATE}")
            return
        try:
            self._transcriber = await asyncio.to_thread(self._transcriber_factory)
        except Exception as error:  # missing package or model download
            print(f"Ask Jenny unavailable: {error}")
            await self._set_status("unavailable", message=str(error))
            return
        print(f"Ask Jenny ready (speech model: {settings.JENNY_STT_MODEL})")
        await self._set_status("idle")
        if self._warm_up:
            # Loads the LLM now (it stays loaded for OLLAMA_KEEP_ALIVE), so the
            # first question doesn't wait for a cold start.
            await self._chat(build_messages("Hello", None), {**llm_options(), "num_predict": 1})

    def can_listen(self) -> bool:
        return self._transcriber is not None and not self.busy

    async def start_listening(self) -> None:
        self.busy = True
        await self._set_status("listening")

    async def answer_audio(self, pcm: bytes) -> None:
        """Transcribe the recorded question, ask the LLM and broadcast the answer."""
        try:
            await self._set_status("thinking")
            recipe = self._load_recipe(self.recipe_id) if self.recipe_id else None
            question = await asyncio.to_thread(
                self._transcriber.transcribe, pcm, COOKING_PROMPT, hotwords(recipe) if recipe else None,
            )
            if not question:
                await self._set_status("idle", message=NOT_HEARD_MESSAGE)
                return

            await self._set_status("thinking", transcript=question)
            answer = await self._chat(build_messages(question, recipe), llm_options())
            await self._broadcast(LLMResponseMessage(data=LLMResponseData(query=question, response=answer)))
            await self._set_status("idle")
        except Exception as error:
            print(f"Ask Jenny error: {error}")
            await self._set_status("idle", message=ERROR_MESSAGE)
        finally:
            self.busy = False


jenny_service = JennyService()
