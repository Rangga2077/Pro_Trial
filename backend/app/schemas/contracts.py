from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Detection(BaseModel):
    bbox: list[float] = Field(..., min_length=4, max_length=4)
    confidence: float
    label: str
    track_id: int = -1


class RawGesture(BaseModel):
    hand: str
    gesture: str
    index_x: Optional[float] = None
    index_y: Optional[float] = None


class GestureAction(str, Enum):
    START_APP = "START_APP"
    RESET_APP = "RESET_APP"
    MENU_NEXT = "MENU_NEXT"
    MENU_PREVIOUS = "MENU_PREVIOUS"
    MENU_CLOSE = "MENU_CLOSE"
    BACK_TO_MENU = "BACK_TO_MENU"
    SELECT_RECIPE = "SELECT_RECIPE"
    NEXT_STEP = "NEXT_STEP"
    PREVIOUS_STEP = "PREVIOUS_STEP"
    TOGGLE_THEME = "TOGGLE_THEME"
    # Session 2 → 3: closed fist or voice "let's cook"
    CONFIRM_READY = "CONFIRM_READY"
    # Voice-only actions (never emitted by the gesture interpreter)
    START_TIMER = "START_TIMER"
    PAUSE_TIMER = "PAUSE_TIMER"
    RESET_TIMER = "RESET_TIMER"
    READ_STEP = "READ_STEP"
    CHECK_INGREDIENT = "CHECK_INGREDIENT"
    # Session 2: "hello jenny" starts recording one free-speech question
    ASK_JENNY = "ASK_JENNY"
    THEME_DARK = "THEME_DARK"
    THEME_LIGHT = "THEME_LIGHT"
    NO_ACTION = "NO_ACTION"


UIMode = Literal["menu", "ingredient_check", "cooking"]


class CVUpdateData(BaseModel):
    frame: str
    objects: list[Detection]
    action: Optional[GestureAction] = None


class CVUpdateMessage(BaseModel):
    type: Literal["cv_update"] = "cv_update"
    data: CVUpdateData


class LLMResponseData(BaseModel):
    query: str
    response: str


class LLMResponseMessage(BaseModel):
    type: Literal["llm_response"] = "llm_response"
    data: LLMResponseData


class StatusData(BaseModel):
    message: str


class StatusMessage(BaseModel):
    type: Literal["status"] = "status"
    data: StatusData


class LLMQueryMessage(BaseModel):
    type: Literal["llm_query"] = "llm_query"
    query: str


class VoiceCommandData(BaseModel):
    action: GestureAction
    transcript: str
    confidence: float


class VoiceCommandMessage(BaseModel):
    type: Literal["voice_command"] = "voice_command"
    data: VoiceCommandData


VoiceState = Literal["disabled", "listening", "error"]


class VoiceStatusData(BaseModel):
    state: VoiceState
    message: Optional[str] = None


class VoiceStatusMessage(BaseModel):
    type: Literal["voice_status"] = "voice_status"
    data: VoiceStatusData


JennyState = Literal["idle", "listening", "thinking", "unavailable"]


class JennyStatusData(BaseModel):
    state: JennyState
    # The heard question while thinking.
    transcript: Optional[str] = None
    # A short note for the HUD, e.g. "Didn't catch that" or why Jenny is unavailable.
    message: Optional[str] = None


class JennyStatusMessage(BaseModel):
    type: Literal["jenny_status"] = "jenny_status"
    data: JennyStatusData


class UIModeMessage(BaseModel):
    """Client → server: which HUD screen is showing, so voice phrases map per screen,
    and which recipe is open, so Jenny can answer about it."""
    type: Literal["ui_mode"] = "ui_mode"
    mode: UIMode
    recipe_id: Optional[str] = None
