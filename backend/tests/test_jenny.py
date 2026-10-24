import asyncio

from app.schemas.recipe import Ingredient, InstructionStep, Recipe
from app.services.jenny import (
    COOKING_PROMPT,
    NOT_HEARD_MESSAGE,
    SYSTEM_PROMPT,
    JennyService,
    build_messages,
    hotwords,
)

FRIED_RICE = Recipe(
    id="fried_rice",
    title="Fried Rice",
    ingredients=[
        Ingredient(name="Cooked Rice", amount=300, unit="g"),
        Ingredient(name="Soy Sauce", amount=1.5, unit="tbsp"),
    ],
    instructions=[InstructionStep(step=1, description="Scramble eggs in a wok and set aside.")],
)


class FakeTranscriber:
    def __init__(self, text: str):
        self.text = text
        self.calls: list[tuple[bytes, str | None, str | None]] = []

    def transcribe(self, pcm: bytes, initial_prompt: str | None = None, hotwords: str | None = None) -> str:
        self.calls.append((pcm, initial_prompt, hotwords))
        return self.text


def make_service(heard: str = "What can I use instead of ham?", answer: str = "Try diced chicken."):
    sent: list[dict] = []
    chats: list[tuple[list[dict], dict]] = []
    transcriber = FakeTranscriber(heard)

    async def broadcast(message):
        sent.append(message.model_dump(mode="json"))

    async def chat(messages, options):
        chats.append((messages, options))
        return answer

    service = JennyService(
        transcriber_factory=lambda: transcriber,
        chat=chat,
        broadcast=broadcast,
        load_recipe=lambda recipe_id: FRIED_RICE if recipe_id == "fried_rice" else None,
        warm_up=False,
    )
    return service, transcriber, sent, chats


def jenny(state: str, transcript: str | None = None, message: str | None = None) -> dict:
    return {"type": "jenny_status", "data": {"state": state, "transcript": transcript, "message": message}}


def test_messages_include_the_recipe_title_and_ingredients():
    system, user = build_messages("What can I use instead of ham?", FRIED_RICE)

    assert system["role"] == "system"
    assert system["content"].startswith(SYSTEM_PROMPT)
    assert "Recipe: Fried Rice" in system["content"]
    assert "Ingredients: Cooked Rice 300 g; Soy Sauce 1.5 tbsp" in system["content"]
    assert user == {"role": "user", "content": "What can I use instead of ham?"}


def test_messages_without_a_recipe_use_the_prompt_only():
    assert build_messages("What is al dente?", None)[0]["content"] == SYSTEM_PROMPT


def test_hotwords_are_the_title_and_ingredient_names():
    assert hotwords(FRIED_RICE) == "Fried Rice, Cooked Rice, Soy Sauce"


def test_answer_flow_broadcasts_thinking_then_the_answer_then_idle():
    service, transcriber, sent, chats = make_service()
    service.set_recipe("fried_rice")

    async def run():
        await service.load()
        await service.start_listening()
        await service.answer_audio(b"\x00\x01" * 10)

    asyncio.run(run())

    assert sent == [
        jenny("idle"),
        jenny("listening"),
        jenny("thinking"),
        jenny("thinking", transcript="What can I use instead of ham?"),
        {"type": "llm_response", "data": {"query": "What can I use instead of ham?", "response": "Try diced chicken."}},
        jenny("idle"),
    ]
    # Whisper gets the cooking prompt and the open recipe's words.
    assert transcriber.calls == [(b"\x00\x01" * 10, COOKING_PROMPT, "Fried Rice, Cooked Rice, Soy Sauce")]
    messages, options = chats[0]
    assert "Recipe: Fried Rice" in messages[0]["content"]
    assert options == {"num_ctx": 2048, "num_predict": 120, "temperature": 0.3}
    assert service.can_listen()


def test_nothing_heard_skips_the_llm():
    service, _transcriber, sent, chats = make_service(heard="")

    async def run():
        await service.load()
        await service.start_listening()
        await service.answer_audio(b"\x00\x00")

    asyncio.run(run())

    assert sent[-1] == jenny("idle", message=NOT_HEARD_MESSAGE)
    assert chats == []
    assert service.can_listen()


def test_without_a_recipe_whisper_gets_no_hotwords():
    service, transcriber, _sent, _chats = make_service()

    async def run():
        await service.load()
        await service.answer_audio(b"\x00\x00")

    asyncio.run(run())

    assert transcriber.calls[0][2] is None


def test_cannot_listen_before_loading_or_while_busy():
    service, _transcriber, _sent, _chats = make_service()
    assert not service.can_listen()
    assert service.status_message().data.state == "unavailable"

    async def run():
        await service.load()
        assert service.can_listen()
        await service.start_listening()

    asyncio.run(run())

    assert not service.can_listen()


def test_load_warms_up_the_llm():
    chats: list[tuple[list[dict], dict]] = []

    async def broadcast(message):
        pass

    async def chat(messages, options):
        chats.append((messages, options))
        return ""

    service = JennyService(transcriber_factory=lambda: FakeTranscriber(""), chat=chat, broadcast=broadcast)
    asyncio.run(service.load())

    assert len(chats) == 1
    assert chats[0][1]["num_predict"] == 1


def test_failed_model_load_leaves_jenny_unavailable():
    sent: list[dict] = []

    async def broadcast(message):
        sent.append(message.model_dump(mode="json"))

    def broken_factory():
        raise RuntimeError("faster-whisper is not installed")

    service = JennyService(transcriber_factory=broken_factory, broadcast=broadcast)
    asyncio.run(service.load())

    assert sent == [jenny("unavailable", message="faster-whisper is not installed")]
    assert not service.can_listen()
