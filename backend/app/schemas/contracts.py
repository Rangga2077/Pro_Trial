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
    NO_ACTION = "NO_ACTION"


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
