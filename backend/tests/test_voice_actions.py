import asyncio

import pytest

from app.engines.audio.pipeline import VoicePipeline
from app.schemas.contracts import GestureAction
from app.services.voice_actions import PHRASES_BY_MODE, VoiceActionInterpreter, all_phrases


def make_interpreter(mode: str = "menu") -> VoiceActionInterpreter:
    interpreter = VoiceActionInterpreter(min_confidence=0.6, min_confidence_single_word=0.8, cooldown_seconds=1.0)
    interpreter.set_mode(mode)
    return interpreter


@pytest.mark.parametrize(
    ("mode", "phrase", "action"),
    [(mode, phrase, action) for mode, phrases in PHRASES_BY_MODE.items() for phrase, action in phrases.items()],
)
def test_each_phrase_maps_to_its_action_on_its_screen(mode, phrase, action):
    assert make_interpreter(mode).interpret(phrase, 0.95, now=10.0) == action


def test_same_word_maps_per_screen():
    assert make_interpreter("menu").interpret("next", 0.95, now=10.0) == GestureAction.MENU_NEXT
    assert make_interpreter("cooking").interpret("next", 0.95, now=10.0) == GestureAction.NEXT_STEP
    assert make_interpreter("menu").interpret("back", 0.95, now=10.0) == GestureAction.MENU_PREVIOUS
    assert make_interpreter("cooking").interpret("back", 0.95, now=10.0) == GestureAction.NO_ACTION


def test_ready_ticks_an_ingredient_and_lets_cook_starts_cooking():
    interpreter = make_interpreter("ingredient_check")
    assert interpreter.interpret("ready", 0.95, now=10.0) == GestureAction.CHECK_INGREDIENT
    assert interpreter.interpret("let's cook", 0.7, now=10.0) == GestureAction.CONFIRM_READY
    # "ready" is said once per item, so it repeats after the cooldown.
    assert interpreter.interpret("ready", 0.95, now=10.5) == GestureAction.NO_ACTION
    assert interpreter.interpret("ready", 0.95, now=11.1) == GestureAction.CHECK_INGREDIENT
    # Neither phrase means anything on the other screens.
    assert make_interpreter("menu").interpret("let's cook", 0.95, now=10.0) == GestureAction.NO_ACTION
    assert make_interpreter("cooking").interpret("ready", 0.95, now=10.0) == GestureAction.NO_ACTION


def test_black_and_white_set_the_theme_on_sessions_2_and_3():
    for mode in ("ingredient_check", "cooking"):
        assert make_interpreter(mode).interpret("black", 0.95, now=10.0) == GestureAction.THEME_DARK
        assert make_interpreter(mode).interpret("white", 0.95, now=10.0) == GestureAction.THEME_LIGHT
    # The menu has no theme switch.
    assert make_interpreter("menu").interpret("black", 0.95, now=10.0) == GestureAction.NO_ACTION


def test_phrases_from_other_screens_are_ignored():
    assert make_interpreter("menu").interpret("start timer", 0.95, now=10.0) == GestureAction.NO_ACTION
    assert make_interpreter("ingredient_check").interpret("next step", 0.95, now=10.0) == GestureAction.NO_ACTION
    assert make_interpreter("cooking").interpret("okay", 0.95, now=10.0) == GestureAction.NO_ACTION


def test_unknown_text_is_ignored():
    interpreter = make_interpreter("cooking")
    assert interpreter.interpret("[unk]", 0.95, now=10.0) == GestureAction.NO_ACTION
    assert interpreter.interpret("[unk] next step", 0.95, now=10.0) == GestureAction.NO_ACTION
    assert interpreter.interpret("", 0.95, now=10.0) == GestureAction.NO_ACTION


def test_transcript_is_normalized():
    assert make_interpreter("cooking").interpret("  Next   STEP ", 0.95, now=10.0) == GestureAction.NEXT_STEP


def test_single_words_need_higher_confidence():
    interpreter = make_interpreter("menu")
    assert interpreter.interpret("next", 0.7, now=10.0) == GestureAction.NO_ACTION
    assert interpreter.interpret("next", 0.85, now=11.0) == GestureAction.MENU_NEXT

    cooking = make_interpreter("cooking")
    assert cooking.interpret("next step", 0.5, now=10.0) == GestureAction.NO_ACTION
    assert cooking.interpret("next step", 0.7, now=11.0) == GestureAction.NEXT_STEP


def test_cooldown_blocks_repeats_of_the_same_action():
    interpreter = make_interpreter("cooking")
    assert interpreter.interpret("next step", 0.9, now=10.0) == GestureAction.NEXT_STEP
    assert interpreter.interpret("next", 0.9, now=10.5) == GestureAction.NO_ACTION
    assert interpreter.interpret("start timer", 0.9, now=10.5) == GestureAction.START_TIMER
    assert interpreter.interpret("next step", 0.9, now=11.2) == GestureAction.NEXT_STEP


def test_grammar_covers_every_phrase():
    grammar = all_phrases()
    assert len(grammar) == len(set(grammar))
    for phrases in PHRASES_BY_MODE.values():
        assert set(phrases) <= set(grammar)


def test_pipeline_broadcasts_only_recognized_commands():
    sent = []

    async def broadcast(message):
        sent.append(message.model_dump(mode="json"))

    pipeline = VoicePipeline(interpreter=make_interpreter("cooking"), broadcast=broadcast)

    async def run():
        await pipeline.handle_transcript("read step", 0.91234)
        await pipeline.handle_transcript("hello there", 0.99)
        await pipeline.set_status("listening")

    asyncio.run(run())

    assert sent == [
        {"type": "voice_command", "data": {"action": "READ_STEP", "transcript": "read step", "confidence": 0.912}},
        {"type": "voice_status", "data": {"state": "listening", "message": None}},
    ]
