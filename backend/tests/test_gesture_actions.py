from app.schemas.contracts import GestureAction, RawGesture
from app.services.gesture_actions import GestureActionInterpreter


def gesture(hand: str, name: str) -> RawGesture:
    return RawGesture(hand=hand, gesture=name)


def pointing(hand: str, x: float, y: float) -> RawGesture:
    return RawGesture(hand=hand, gesture="POINTING_UP", index_x=x, index_y=y)


def test_dual_pointing_starts_and_resets_app():
    interpreter = GestureActionInterpreter(dual_trigger_frames=1)
    hands = [gesture("Left", "POINTING_UP"), gesture("Right", "POINTING_UP")]

    assert interpreter.interpret(hands, now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret(hands, now=3.1) == GestureAction.START_APP

    assert interpreter.interpret(hands, now=4.0) == GestureAction.NO_ACTION
    assert interpreter.interpret(hands, now=6.2) == GestureAction.RESET_APP


def test_menu_swipes_move_selection_one_action_per_cooldown():
    interpreter = GestureActionInterpreter(cooldown_seconds=0.5, swipe_threshold=0.1)
    interpreter.mode = "menu"

    assert interpreter.interpret([pointing("Right", 0.5, 0.5)], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([pointing("Right", 0.5, 0.37)], now=1.6) == GestureAction.MENU_NEXT
    assert interpreter.interpret([pointing("Right", 0.5, 0.24)], now=1.8) == GestureAction.NO_ACTION
    assert interpreter.interpret([pointing("Right", 0.5, 0.52)], now=2.2) == GestureAction.MENU_PREVIOUS


def test_fist_select_still_works_in_menu():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.SELECT_RECIPE


def test_open_palm_maps_to_menu_close_or_next_step_by_mode():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=1.6) == GestureAction.MENU_CLOSE

    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=2.8) == GestureAction.NO_ACTION


def test_recipe_step_swipes_left_and_right():
    interpreter = GestureActionInterpreter(cooldown_seconds=0.5, swipe_threshold=0.1)
    interpreter.mode = "cooking"

    assert interpreter.interpret([pointing("Right", 0.5, 0.5)], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([pointing("Right", 0.36, 0.5)], now=1.6) == GestureAction.NEXT_STEP
    assert interpreter.interpret([pointing("Right", 0.64, 0.5)], now=2.2) == GestureAction.PREVIOUS_STEP
