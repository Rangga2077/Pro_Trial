from app.schemas.contracts import CVUpdateData, RawGesture
from app.services.gesture_log import HandGestureLog


def gesture(hand: str, name: str) -> RawGesture:
    return RawGesture(hand=hand, gesture=name)


def test_logs_only_changes_per_hand():
    log = HandGestureLog(enabled=False)

    assert log.update([gesture("Right", "POINTING_UP")]) == ["[gesture-log] Right hand detected: POINTING_UP"]
    assert log.update([gesture("Right", "POINTING_UP")]) == []
    assert log.update([gesture("Right", "OPEN_PALM"), gesture("Left", "UNKNOWN")]) == [
        "[gesture-log] Right hand: POINTING_UP -> OPEN_PALM",
        "[gesture-log] Left hand detected: UNKNOWN",
    ]
    assert log.update([gesture("Left", "UNKNOWN")]) == ["[gesture-log] Right hand lost"]
    assert log.update([]) == ["[gesture-log] Left hand lost"]
    assert log.update([]) == []


def test_cv_update_hands_default_empty():
    assert CVUpdateData(frame="", objects=[]).model_dump()["hands"] == []
