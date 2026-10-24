from app.schemas.contracts import GestureAction, RawGesture
from app.services.gesture_actions import GestureActionInterpreter


def gesture(hand: str, name: str) -> RawGesture:
    return RawGesture(hand=hand, gesture=name)


def pointing(hand: str, x: float, y: float) -> RawGesture:
    return RawGesture(hand=hand, gesture="POINTING_UP", index_x=x, index_y=y)


def test_dual_pointing_resets_app_to_menu():
    # No idle screen: holding both index fingers up always resets to the menu.
    interpreter = GestureActionInterpreter(dual_trigger_frames=1)
    interpreter.mode = "cooking"
    hands = [gesture("Left", "POINTING_UP"), gesture("Right", "POINTING_UP")]

    assert interpreter.interpret(hands, now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret(hands, now=3.1) == GestureAction.RESET_APP
    assert interpreter.mode == "menu"

    assert interpreter.interpret(hands, now=4.0) == GestureAction.NO_ACTION
    assert interpreter.interpret(hands, now=6.2) == GestureAction.RESET_APP


def test_left_pointing_moves_menu_selection_back_once_until_released():
    interpreter = GestureActionInterpreter(
        pointer_release_seconds=0.25,
        pointer_repeat_seconds=0.75,
    )
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.0) == GestureAction.MENU_PREVIOUS
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.74) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.75) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=1.9) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=2.5) == GestureAction.MENU_PREVIOUS


def test_releasing_left_pointing_rearms_menu_selection():
    interpreter = GestureActionInterpreter(
        pointer_release_seconds=0.25,
        pointer_repeat_seconds=0.75,
    )
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=1.0) == GestureAction.MENU_PREVIOUS
    assert interpreter.interpret([], now=1.1) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=1.4) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Left", "POINTING_UP")], now=2.1) == GestureAction.MENU_PREVIOUS


def test_menu_swipes_do_not_move_selection():
    # The raised finger moves the carousel once; moving it around (a swipe) adds nothing.
    interpreter = GestureActionInterpreter(cooldown_seconds=0.16, swipe_threshold=0.06)
    interpreter.mode = "menu"

    assert interpreter.interpret([pointing("Right", 0.5, 0.5)], now=1.0) == GestureAction.MENU_NEXT
    assert interpreter.interpret([pointing("Right", 0.5, 0.57)], now=1.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([pointing("Right", 0.5, 0.43)], now=1.4) == GestureAction.NO_ACTION
    assert interpreter.interpret([pointing("Right", 0.6, 0.43)], now=1.6) == GestureAction.NO_ACTION


def test_right_pointing_moves_menu_selection_forward():
    interpreter = GestureActionInterpreter(cooldown_seconds=0.16)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "POINTING_UP")], now=1.0) == GestureAction.MENU_NEXT


def test_fist_select_still_works_in_menu():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.SELECT_RECIPE


def test_held_fist_after_select_does_not_immediately_start_cooking():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.SELECT_RECIPE
    assert interpreter.mode == "ingredient_check"
    # The frontend reports the new screen; the held fist must still not confirm.
    interpreter.set_mode("ingredient_check")
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.3) == GestureAction.NO_ACTION
    assert interpreter.interpret([], now=2.7) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=3.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=3.6) == GestureAction.CONFIRM_READY
    assert interpreter.mode == "cooking"


def test_open_palm_does_nothing_in_menu():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "menu"

    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=1.6) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.mode == "menu"


def test_fist_in_ingredient_check_starts_cooking():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "ingredient_check"

    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.CONFIRM_READY
    assert interpreter.mode == "cooking"


def test_open_palm_in_ingredient_check_returns_to_menu():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "ingredient_check"

    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "OPEN_PALM")], now=1.6) == GestureAction.BACK_TO_MENU
    assert interpreter.mode == "menu"


def test_thumb_up_in_ingredient_check_toggles_theme():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "ingredient_check"

    assert interpreter.interpret([gesture("Right", "THUMB_UP")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "THUMB_UP")], now=1.6) == GestureAction.TOGGLE_THEME
    assert interpreter.mode == "ingredient_check"


def test_pointing_in_ingredient_check_does_nothing():
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    interpreter.mode = "ingredient_check"

    for hand in ("Right", "Left"):
        assert interpreter.interpret([pointing(hand, 0.5, 0.5)], now=1.0) == GestureAction.NO_ACTION
        assert interpreter.interpret([pointing(hand, 0.7, 0.5)], now=1.6) == GestureAction.NO_ACTION
        assert interpreter.interpret([pointing(hand, 0.3, 0.5)], now=2.2) == GestureAction.NO_ACTION
    assert interpreter.mode == "ingredient_check"


def test_set_mode_from_voice_makes_next_fist_start_cooking():
    # The screen changed by voice ("okay"), not by fist: ui_mode syncs the interpreter.
    interpreter = GestureActionInterpreter(required_frames=1, cooldown_seconds=0.5)
    assert interpreter.mode == "menu"

    interpreter.set_mode("ingredient_check")
    assert interpreter.mode == "ingredient_check"
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.0) == GestureAction.NO_ACTION
    assert interpreter.interpret([gesture("Right", "CLOSED_FIST")], now=1.6) == GestureAction.CONFIRM_READY
    assert interpreter.mode == "cooking"


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
