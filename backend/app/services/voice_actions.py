"""Voice phrase → UI action mapping.

The frontend reports which HUD screen is showing (`ui_mode`), so the same
word can mean different things per screen ("next" = next recipe on the
menu, next step while cooking). Pure and clock-injected for unit tests.
"""

import time
from dataclasses import dataclass, field

from app.core.config import settings
from app.schemas.contracts import GestureAction, UIMode

PHRASES_BY_MODE: dict[str, dict[str, GestureAction]] = {
    "menu": {
        "next": GestureAction.MENU_NEXT,
        "back": GestureAction.MENU_PREVIOUS,
        "okay": GestureAction.SELECT_RECIPE,
    },
    "ingredient_check": {
        "ready": GestureAction.CONFIRM_READY,
        "back to menu": GestureAction.BACK_TO_MENU,
        "black": GestureAction.THEME_DARK,
        "white": GestureAction.THEME_LIGHT,
    },
    "cooking": {
        "next step": GestureAction.NEXT_STEP,
        "next": GestureAction.NEXT_STEP,
        "previous step": GestureAction.PREVIOUS_STEP,
        "go back": GestureAction.PREVIOUS_STEP,
        "back to menu": GestureAction.BACK_TO_MENU,
        "start timer": GestureAction.START_TIMER,
        "pause timer": GestureAction.PAUSE_TIMER,
        "reset timer": GestureAction.RESET_TIMER,
        "read step": GestureAction.READ_STEP,
        "black": GestureAction.THEME_DARK,
        "white": GestureAction.THEME_LIGHT,
    },
}


def all_phrases() -> list[str]:
    """Every phrase on every screen — becomes the recognizer grammar."""
    return sorted({phrase for phrases in PHRASES_BY_MODE.values() for phrase in phrases})


def normalize(transcript: str) -> str:
    return " ".join(transcript.lower().split())


@dataclass
class VoiceActionInterpreter:
    min_confidence: float = settings.VOICE_MIN_CONFIDENCE
    min_confidence_single_word: float = settings.VOICE_MIN_CONFIDENCE_SINGLE_WORD
    cooldown_seconds: float = settings.VOICE_COOLDOWN_SECONDS
    mode: str = "menu"
    last_fired_at: dict[GestureAction, float] = field(default_factory=dict)

    def set_mode(self, mode: UIMode) -> None:
        self.mode = mode

    def interpret(self, transcript: str, confidence: float, now: float | None = None) -> GestureAction:
        current_time = now if now is not None else time.monotonic()
        phrase = normalize(transcript)

        action = PHRASES_BY_MODE.get(self.mode, {}).get(phrase)
        if action is None:
            return GestureAction.NO_ACTION

        # Short single words ("next", "okay") misfire more in conversation.
        threshold = self.min_confidence_single_word if " " not in phrase else self.min_confidence
        if confidence < threshold:
            return GestureAction.NO_ACTION

        if current_time - self.last_fired_at.get(action, float("-inf")) < self.cooldown_seconds:
            return GestureAction.NO_ACTION

        self.last_fired_at[action] = current_time
        return action


voice_action_interpreter = VoiceActionInterpreter()
