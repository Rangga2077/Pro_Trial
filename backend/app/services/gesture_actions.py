import time
from dataclasses import dataclass, field

from app.core.config import settings
from app.schemas.contracts import GestureAction, RawGesture


@dataclass
class SwipeAnchor:
    x: float
    y: float


@dataclass
class GestureMonitor:
    enabled: bool = True
    sample_seconds: float = 0.25
    last_sample_at: dict[str, float] = field(default_factory=dict)

    def anchor(self, hand: str, x: float, y: float, mode: str):
        if not self.enabled:
            return
        print(f"[gesture-monitor] {hand} index anchor x={x:.3f} y={y:.3f} mode={mode}")

    def sample(self, hand: str, x: float, y: float, dx: float, dy: float, threshold: float, mode: str, now: float):
        if not self.enabled:
            return
        if now - self.last_sample_at.get(hand, 0.0) < self.sample_seconds:
            return

        self.last_sample_at[hand] = now
        direction = self._dominant_direction(dx, dy)
        progress = max(abs(dx), abs(dy))
        print(
            "[gesture-monitor] "
            f"{hand} index x={x:.3f} y={y:.3f} dx={dx:+.3f} dy={dy:+.3f} "
            f"dominant={direction} progress={progress:.3f}/{threshold:.3f} mode={mode}"
        )

    def observed_swipe(self, hand: str, direction: str, dx: float, dy: float, mode: str):
        if not self.enabled:
            return
        print(
            "[gesture-monitor] "
            f"SWIPE_{direction} observed from {hand} dx={dx:+.3f} dy={dy:+.3f} mode={mode}"
        )

    def blocked_by_cooldown(self, direction: str, elapsed: float, cooldown: float):
        if not self.enabled:
            return
        print(
            "[gesture-monitor] "
            f"SWIPE_{direction} waiting cooldown {elapsed:.2f}s/{cooldown:.2f}s"
        )

    def fired(self, direction: str, action: GestureAction):
        if not self.enabled:
            return
        print(f"[gesture-monitor] SWIPE_{direction} -> {action.value}")

    @staticmethod
    def _dominant_direction(dx: float, dy: float) -> str:
        if abs(dx) >= abs(dy):
            return "RIGHT" if dx > 0 else "LEFT"
        return "DOWN" if dy > 0 else "UP"


@dataclass
class GestureActionInterpreter:
    required_frames: int = 3
    dual_trigger_frames: int = 10
    cooldown_seconds: float = settings.GESTURE_ACTION_COOLDOWN_SECONDS
    trigger_cooldown_seconds: float = 2.0
    swipe_threshold: float = settings.GESTURE_SWIPE_THRESHOLD
    monitor_enabled: bool = settings.GESTURE_MONITOR_ENABLED
    monitor_sample_seconds: float = settings.GESTURE_MONITOR_SAMPLE_SECONDS
    mode: str = "idle"
    gesture_counts: dict[str, int] = field(default_factory=dict)
    swipe_anchors: dict[str, SwipeAnchor] = field(default_factory=dict)
    last_action_at: float = 0.0
    monitor: GestureMonitor = field(init=False)

    def __post_init__(self):
        self.monitor = GestureMonitor(
            enabled=self.monitor_enabled,
            sample_seconds=self.monitor_sample_seconds,
        )

    def interpret(self, gestures: list[RawGesture], now: float | None = None) -> GestureAction:
        current_time = now if now is not None else time.monotonic()

        if not gestures:
            self.gesture_counts.clear()
            self.swipe_anchors.clear()
            return GestureAction.NO_ACTION

        if self._has_dual_pointing_up(gestures):
            self.swipe_anchors.clear()
            return self._handle_dual_trigger(current_time)

        self.gesture_counts["DUAL_TRIGGER"] = 0

        swipe_action = self._detect_swipe_action(gestures, current_time)
        if swipe_action != GestureAction.NO_ACTION:
            return swipe_action

        primary_gesture = gestures[0].gesture
        self._count_only(primary_gesture)

        if self.gesture_counts[primary_gesture] <= self.required_frames:
            return GestureAction.NO_ACTION

        if current_time - self.last_action_at < self.cooldown_seconds:
            return GestureAction.NO_ACTION

        action = self._map_primary_gesture(primary_gesture)
        if action == GestureAction.NO_ACTION:
            return action

        self.last_action_at = current_time
        self.gesture_counts[primary_gesture] = 0
        return action

    def _detect_swipe_action(self, gestures: list[RawGesture], current_time: float) -> GestureAction:
        pointing_gestures = [
            gesture
            for gesture in gestures
            if gesture.gesture == "POINTING_UP" and gesture.index_x is not None and gesture.index_y is not None
        ]

        active_hands = {gesture.hand for gesture in pointing_gestures}
        for hand in list(self.swipe_anchors):
            if hand not in active_hands:
                self.swipe_anchors.pop(hand, None)

        if len(pointing_gestures) != 1:
            return GestureAction.NO_ACTION

        gesture = pointing_gestures[0]
        assert gesture.index_x is not None
        assert gesture.index_y is not None

        anchor = self.swipe_anchors.get(gesture.hand)
        if anchor is None:
            self.swipe_anchors[gesture.hand] = SwipeAnchor(gesture.index_x, gesture.index_y)
            self.monitor.anchor(gesture.hand, gesture.index_x, gesture.index_y, self.mode)
            return GestureAction.NO_ACTION

        dx = gesture.index_x - anchor.x
        dy = gesture.index_y - anchor.y
        self.monitor.sample(
            hand=gesture.hand,
            x=gesture.index_x,
            y=gesture.index_y,
            dx=dx,
            dy=dy,
            threshold=self.swipe_threshold,
            mode=self.mode,
            now=current_time,
        )

        direction = self._swipe_direction(dx, dy)
        if direction is None:
            return GestureAction.NO_ACTION

        self.monitor.observed_swipe(gesture.hand, direction, dx, dy, self.mode)
        action = self._map_swipe_direction(direction)

        if action == GestureAction.NO_ACTION:
            return action

        elapsed = current_time - self.last_action_at
        if elapsed < self.cooldown_seconds:
            self.monitor.blocked_by_cooldown(direction, elapsed, self.cooldown_seconds)
            return GestureAction.NO_ACTION

        self.last_action_at = current_time
        self.swipe_anchors[gesture.hand] = SwipeAnchor(gesture.index_x, gesture.index_y)
        self.monitor.fired(direction, action)
        return action

    def _swipe_direction(self, dx: float, dy: float) -> str | None:
        if abs(dx) >= abs(dy):
            if abs(dx) < self.swipe_threshold:
                return None
            return "LEFT" if dx < 0 else "RIGHT"

        if abs(dy) < self.swipe_threshold:
            return None
        return "UP" if dy < 0 else "DOWN"

    def _map_swipe_direction(self, direction: str) -> GestureAction:
        if self.mode == "menu":
            if direction == "UP":
                return GestureAction.MENU_NEXT
            if direction == "DOWN":
                return GestureAction.MENU_PREVIOUS

        if self.mode == "cooking":
            if direction == "LEFT":
                return GestureAction.NEXT_STEP
            if direction == "RIGHT":
                return GestureAction.PREVIOUS_STEP

        return GestureAction.NO_ACTION

    def _handle_dual_trigger(self, current_time: float) -> GestureAction:
        self.gesture_counts["DUAL_TRIGGER"] = self.gesture_counts.get("DUAL_TRIGGER", 0) + 1

        if self.gesture_counts["DUAL_TRIGGER"] <= self.dual_trigger_frames:
            return GestureAction.NO_ACTION

        if current_time - self.last_action_at < self.trigger_cooldown_seconds:
            return GestureAction.NO_ACTION

        self.last_action_at = current_time
        self.gesture_counts.clear()

        if self.mode == "idle":
            self.mode = "menu"
            return GestureAction.START_APP

        self.mode = "idle"
        return GestureAction.RESET_APP

    def _map_primary_gesture(self, gesture: str) -> GestureAction:
        if gesture == "CLOSED_FIST":
            self.mode = "cooking"
            return GestureAction.SELECT_RECIPE
        if gesture in {"FIVE_FINGERS", "OPEN_PALM"}:
            if self.mode == "menu":
                self.mode = "cooking"
                return GestureAction.MENU_CLOSE
            return GestureAction.NO_ACTION
        if gesture == "THREE_FINGERS":
            self.mode = "menu"
            return GestureAction.START_APP
        return GestureAction.NO_ACTION

    def _count_only(self, active_key: str):
        self.gesture_counts[active_key] = self.gesture_counts.get(active_key, 0) + 1
        for key in list(self.gesture_counts):
            if key != active_key and key != "DUAL_TRIGGER":
                self.gesture_counts[key] = 0

    @staticmethod
    def _has_dual_pointing_up(gestures: list[RawGesture]) -> bool:
        has_left = any(g.hand == "Left" and g.gesture == "POINTING_UP" for g in gestures)
        has_right = any(g.hand == "Right" and g.gesture == "POINTING_UP" for g in gestures)
        return has_left and has_right


gesture_action_interpreter = GestureActionInterpreter()
