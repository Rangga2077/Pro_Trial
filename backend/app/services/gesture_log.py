from dataclasses import dataclass, field

from app.core.config import settings
from app.schemas.contracts import RawGesture


@dataclass
class HandGestureLog:
    """Logs every raw gesture change per hand: a hand coming into view, a new
    gesture, and a hand leaving view. Unchanged frames log nothing, so the
    ~30 fps stream doesn't flood stdout."""
    enabled: bool = settings.GESTURE_LOG_ENABLED
    current: dict[str, str] = field(default_factory=dict)

    def update(self, gestures: list[RawGesture]) -> list[str]:
        seen: dict[str, str] = {}
        for gesture in gestures:
            seen.setdefault(gesture.hand, gesture.gesture)

        lines: list[str] = []
        for hand, gesture in seen.items():
            previous = self.current.get(hand)
            if previous is None:
                lines.append(f"[gesture-log] {hand} hand detected: {gesture}")
            elif previous != gesture:
                lines.append(f"[gesture-log] {hand} hand: {previous} -> {gesture}")
        for hand in self.current:
            if hand not in seen:
                lines.append(f"[gesture-log] {hand} hand lost")

        self.current = seen
        if self.enabled:
            for line in lines:
                print(line)
        return lines


hand_gesture_log = HandGestureLog()
