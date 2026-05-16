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


def test_left_pointing_moves_menu_selection_once_until_released():
    interpreter = GestureActionInterpreter(
        pointer_release_seconds=0.25,
        pointer_repeat_seconds=0.75,
    )
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.0) == GestureAction.MENU_NEXT
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.74) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.75) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=1.9) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=2.5) == GestureAction.MENU_NEXT


def test_releasing_left_pointing_rearms_menu_selection():
    interpreter = GestureActionInterpreter(
        pointer_release_seconds=0.25,
        pointer_repeat_seconds=0.75,
    )
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.0) == GestureAction.MENU_NEXT
    assert interpreter.interpret([], now=1.1) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=1.4) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.0) == GestureAction.NO_ACTION


def test_start_app_delays_left_pointer_repeat():
    interpreter = GestureActionInterpreter(
        dual_trigger_frames=1,
        pointer_release_seconds=0.25,
        pointer_repeat_seconds=0.75,
    )
    hands = [gesture("Left", "POINTING_UP"), gesture("Right", "POINTING_UP")]

    assert interpreter.interpret(hands, now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret(hands, now=3.1) == GestureAction.START_APP
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=3.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=3.84) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=3.85) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=3.95) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=4.3) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=4.5) == GestureAction.MENU_NEXT


def test_menu_swipes_do_not_move_selection():
    interpreter = GestureActionInterpreter(cooldown_seconds=0.16, swipe_threshold=0.06)
    interpreter.mode = "menu"

    assert interpreter.interpret([pointing("Right", 0.5, 0.5)], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([pointing("Right", 0.5, 0.57)], now=1.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([pointing("Right", 0.5, 0.43)], now=1.4) == GestureAction.NO_ACTION


def test_right_pointing_does_not_move_menu_selection():
    interpreter = GestureActionInterpreter(cooldown_seconds=0.16)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "POINTING_UP")], now=1.0) == GestureAction.NO_ACTION


def test_fist_select_still_works_in_menu():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.SELECT_RECIPE


def test_held_fist_after_select_does_not_immediately_return_to_menu():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.SELECT_RECIPE
    assert interpreter.mode == "cooking"
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.3) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.7) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=3.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=3.6) == GestureAction.BACK_TO_MENU


def test_open_palm_maps_to_menu_close_or_next_step_by_mode():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=1.6) == GestureAction.MENU_CLOSE

    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=2.8) == GestureAction.NO_ACTION


def test_right_pointing_moves_to_next_cooking_step_once_until_released():
    interpreter = GestureActionInterpreter(
        pointer_release_seconds=0.25,
        pointer_repeat_seconds=0.75,
    )
    interpreter.mode = "cooking"

    assert interpreter.interpret([gesture("Right", "POINTING_UP")], now=1.0) == GestureAction.NEXT_STEP
    assert interpreter.interpret([gesture("Right", "POINTING_UP")], now=1.4) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "POINTING_UP")], now=1.75) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "POINTING_UP")], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.3) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.6) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "POINTING_UP")], now=2.8) == GestureAction.NEXT_STEP


def test_left_pointing_moves_to_previous_cooking_step_once_until_released():
    interpreter = GestureActionInterpreter(
        pointer_release_seconds=0.25,
        pointer_repeat_seconds=0.75,
    )
    interpreter.mode = "cooking"

    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.0) == GestureAction.PREVIOUS_STEP
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.4) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.75) == GestureAction.NO_ACTION


def test_cooking_pointing_repeat_stops_after_release():
    interpreter = GestureActionInterpreter(
        pointer_release_seconds=0.25,
        pointer_repeat_seconds=0.75,
    )
    interpreter.mode = "cooking"

    assert interpreter.interpret([gesture("Right", "POINTING_UP")], now=1.0) == GestureAction.NEXT_STEP
    assert interpreter.interpret([], now=1.1) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=1.4) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.0) == GestureAction.NO_ACTION


def test_cooking_swipes_do_not_move_steps():
    interpreter = GestureActionInterpreter(cooldown_seconds=0.5, swipe_threshold=0.1)
    interpreter.mode = "cooking"

    assert interpreter.interpret([pointing("Right", 0.5, 0.5)], now=1.0) == GestureAction.NEXT_STEP
    assert interpreter.interpret([pointing("Right", 0.36, 0.5)], now=1.6) == GestureAction.NO_ACTION
    assert interpreter.interpret([pointing("Left", 0.5, 0.5)], now=2.2) == GestureAction.PREVIOUS_STEP
    assert interpreter.interpret([pointing("Left", 0.64, 0.5)], now=2.8) == GestureAction.NO_ACTION


def test_closed_fist_returns_from_cooking_to_menu():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "cooking"

    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.BACK_TO_MENU
    assert interpreter.mode == "menu"


def test_held_fist_after_back_to_menu_does_not_immediately_select_recipe():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "cooking"

    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.BACK_TO_MENU
    assert interpreter.mode == "menu"
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.3) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.7) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=3.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=3.6) == GestureAction.SELECT_RECIPE
