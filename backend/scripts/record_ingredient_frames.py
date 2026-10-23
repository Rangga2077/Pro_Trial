"""
record_ingredient_frames.py
---------------------------
Records training frames for the ingredient detector from the CoCI station camera
(or from a video file). Frames are saved clean (no overlay) per class, and near-
duplicates are skipped with a perceptual hash, so auto-save only keeps frames
where something actually changed.

Output:
data/dataset/raw_images/{class_name}/clean/{session}_{NNNN}.jpg
data/dataset/raw_images/background/clean/{session}_{NNNN}.jpg

Keys (live window):
  SPACE  save one frame          A    auto-save on/off
  N / P  next / previous class   B    jump to background
  Q/Esc  quit and print a summary

Stop the CoCI backend first (press ENTER in the start_app.bat window):
only one program can use the webcam on Windows.

Usage:
  python backend/scripts/record_ingredient_frames.py --classes chicken_breast_meat,peanuts,soy_sauce,chicken_egg,carrot
  python backend/scripts/record_ingredient_frames.py --classes carrot --session 20261013-1930
  python backend/scripts/record_ingredient_frames.py --video clip.mp4 --classes carrot
"""

import argparse
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import imagehash
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.config import settings  # noqa: E402  (reads backend/.env)
from ingredient_classes import BACKGROUND, CLASSES  # noqa: E402

RAW_DIR = PROJECT_ROOT / "data" / "dataset" / "raw_images"
WINDOW_NAME = "CoCI ingredient recorder"
JPEG_QUALITY = 95
SAVED_FLASH_SECONDS = 0.35
CAMERA_BUSY_MESSAGE = "Camera busy or missing - is the CoCI backend still running? (start_app.bat)"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Record clean, de-duplicated training frames per ingredient class."
    )
    parser.add_argument("--camera", type=int, default=settings.CAMERA_INDEX, help="Camera index (default: CAMERA_INDEX).")
    parser.add_argument("--width", type=int, default=settings.CAMERA_WIDTH, help="Capture width (default: CAMERA_WIDTH).")
    parser.add_argument("--height", type=int, default=settings.CAMERA_HEIGHT, help="Capture height (default: CAMERA_HEIGHT).")
    parser.add_argument(
        "--classes",
        type=str,
        default=None,
        help="Comma-separated subset of classes (default: all classes). 'background' is always available.",
    )
    parser.add_argument("--interval", type=float, default=0.5, help="Seconds between auto-saves (default: 0.5).")
    parser.add_argument(
        "--min-change",
        type=int,
        default=6,
        help="Minimum pHash Hamming distance from the last saved frame (default: 6).",
    )
    parser.add_argument(
        "--video",
        type=str,
        default=None,
        help="Extract frames from a video file instead of the camera (needs exactly one --classes).",
    )
    parser.add_argument(
        "--session",
        type=str,
        default=None,
        help="Session id override, e.g. to continue a session (default: now, %%Y%%m%%d-%%H%%M).",
    )
    return parser.parse_args()


def parse_classes(raw: Optional[str]) -> List[str]:
    """Validates the --classes list and makes sure 'background' is always selectable."""
    if raw is None:
        selected = list(CLASSES)
    else:
        selected = [name.strip() for name in raw.split(",") if name.strip()]
        unknown = [name for name in selected if name not in CLASSES and name != BACKGROUND]
        if unknown:
            print(f"[ERROR] Unknown class(es): {', '.join(unknown)}")
            print(f"        Valid: {', '.join(CLASSES)}, {BACKGROUND}")
            sys.exit(2)
        selected = list(dict.fromkeys(selected))  # drop repeats, keep order
    if BACKGROUND not in selected:
        selected.append(BACKGROUND)
    return selected


def class_dir(class_name: str) -> Path:
    return RAW_DIR / class_name / "clean"


def next_index(folder: Path, session: str) -> int:
    """Continues numbering after the highest existing {session}_NNNN.jpg in the folder."""
    if not folder.exists():
        return 1
    pattern = re.compile(rf"^{re.escape(session)}_(\d+)\.jpg$", re.IGNORECASE)
    numbers = [int(m.group(1)) for f in folder.iterdir() if (m := pattern.match(f.name))]
    return max(numbers, default=0) + 1


def count_images(folder: Path) -> int:
    if not folder.exists():
        return 0
    return sum(1 for f in folder.iterdir() if f.suffix.lower() == ".jpg")


def frame_hash(frame) -> imagehash.ImageHash:
    return imagehash.phash(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))


class FrameSaver:
    """Saves frames per class with continued numbering and the pHash duplicate filter."""

    def __init__(self, session: str, interval: float, min_change: int):
        self.session = session
        self.interval = interval
        self.min_change = min_change
        self.saved: Dict[str, int] = {}
        self._next: Dict[str, int] = {}
        self._last_hash: Dict[str, Optional[imagehash.ImageHash]] = {}
        self._last_time: Dict[str, float] = {}

    def reset(self, class_name: str) -> None:
        self._last_hash[class_name] = None
        self._last_time.pop(class_name, None)

    def save(self, frame, class_name: str, now: float, frame_hash_value=None) -> Path:
        folder = class_dir(class_name)
        folder.mkdir(parents=True, exist_ok=True)
        if class_name not in self._next:
            self._next[class_name] = next_index(folder, self.session)
        path = folder / f"{self.session}_{self._next[class_name]:04d}.jpg"

        # imencode + write_bytes instead of imwrite: works with any Windows path.
        ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if not ok:
            raise RuntimeError(f"Could not encode frame for {path}")
        path.write_bytes(buffer.tobytes())

        self._next[class_name] += 1
        self.saved[class_name] = self.saved.get(class_name, 0) + 1
        self._last_hash[class_name] = frame_hash_value if frame_hash_value is not None else frame_hash(frame)
        self._last_time[class_name] = now
        return path

    def maybe_auto_save(self, frame, class_name: str, now: float) -> bool:
        """Saves only when --interval has passed and the frame differs enough from the last saved one."""
        last_time = self._last_time.get(class_name)
        if last_time is not None and now - last_time < self.interval:
            return False
        current = frame_hash(frame)
        last = self._last_hash.get(class_name)
        if last is not None and (current - last) < self.min_change:
            return False
        self.save(frame, class_name, now, current)
        return True


def open_camera(index: int, width: int, height: int):
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW) if os.name == "nt" else cv2.VideoCapture(index)
    if not cap.isOpened():
        return None, None
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    ok, frame = cap.read()
    if not ok or frame is None:
        cap.release()
        return None, None
    return cap, frame


def draw_overlay(frame, class_name: str, saver: FrameSaver, auto_on: bool, flash: bool, position: str):
    """Draws the HUD on a copy; the frame passed in (and saved) stays clean."""
    view = frame.copy()
    session_count = saver.saved.get(class_name, 0)
    total = count_images(class_dir(class_name))
    lines = [
        (f"CLASS: {class_name}  {position}", (255, 255, 255)),
        (f"saved this session: {session_count}   folder total: {total}", (255, 255, 255)),
        (f"AUTO-SAVE: {'ON' if auto_on else 'OFF'}", (80, 220, 80) if auto_on else (80, 80, 255)),
        ("SPACE save | A auto | N/P class | B background | Q quit", (200, 200, 200)),
    ]
    cv2.rectangle(view, (0, 0), (view.shape[1], 18 + 28 * len(lines)), (0, 0, 0), -1)
    for i, (text, color) in enumerate(lines):
        cv2.putText(view, text, (12, 30 + 28 * i), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2, cv2.LINE_AA)
    if flash:
        h, w = view.shape[:2]
        cv2.rectangle(view, (0, 0), (w - 1, h - 1), (0, 220, 0), 12)
        cv2.putText(view, "SAVED", (w - 170, h - 30), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 220, 0), 3, cv2.LINE_AA)
    return view


def print_summary(saver: FrameSaver, classes: List[str]) -> None:
    print("\n" + "=" * 60)
    print(f"SESSION {saver.session} SUMMARY")
    print("=" * 60)
    for name in classes:
        print(f"  {name:<22} saved {saver.saved.get(name, 0):4d}   folder total {count_images(class_dir(name)):4d}")
    print(f"  {'TOTAL':<22} saved {sum(saver.saved.values()):4d}")
    print("=" * 60 + "\n")


def run_camera(args, classes: List[str], saver: FrameSaver) -> int:
    cap, frame = open_camera(args.camera, args.width, args.height)
    if cap is None:
        print(CAMERA_BUSY_MESSAGE)
        return 1

    print(f"Camera {args.camera}: {frame.shape[1]}x{frame.shape[0]}")
    current = 0
    auto_on = False
    flash_until = 0.0
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)

    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                print("[ERROR] Lost the camera feed.")
                break
            now = time.monotonic()
            class_name = classes[current]

            if auto_on and saver.maybe_auto_save(frame, class_name, now):
                flash_until = now + SAVED_FLASH_SECONDS

            position = f"({current + 1}/{len(classes)})"
            cv2.imshow(WINDOW_NAME, draw_overlay(frame, class_name, saver, auto_on, now < flash_until, position))

            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), ord("Q"), 27):
                break
            if key == ord(" "):
                saver.save(frame, class_name, now)
                flash_until = now + SAVED_FLASH_SECONDS
            elif key in (ord("a"), ord("A")):
                auto_on = not auto_on
            elif key in (ord("n"), ord("N"), ord("p"), ord("P"), ord("b"), ord("B")):
                if key in (ord("n"), ord("N")):
                    current = (current + 1) % len(classes)
                elif key in (ord("p"), ord("P")):
                    current = (current - 1) % len(classes)
                else:
                    current = classes.index(BACKGROUND)
                saver.reset(classes[current])

            # Closing the window with its X button also quits.
            if cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1:
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    print_summary(saver, classes)
    return 0


def run_video(args, classes: List[str], saver: FrameSaver) -> int:
    video_path = Path(args.video)
    if not video_path.is_absolute():
        video_path = Path.cwd() / video_path
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[ERROR] Could not open video '{video_path}'.")
        return 1

    class_name = classes[0]
    print(f"Video: {video_path} -> class '{class_name}'")
    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            # Timed by the video position, not the wall clock.
            position_seconds = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            saver.maybe_auto_save(frame, class_name, position_seconds)
    finally:
        cap.release()

    print(f"Saved {saver.saved.get(class_name, 0)} frames to {class_dir(class_name)}")
    return 0


def main() -> int:
    args = parse_args()
    classes = parse_classes(args.classes)
    session = args.session or datetime.now().strftime("%Y%m%d-%H%M")
    saver = FrameSaver(session, args.interval, args.min_change)

    print("=" * 60)
    print("      COCI INGREDIENT FRAME RECORDER      ")
    print("=" * 60)
    print(f"Session       : {session}")
    print(f"Output Root   : {RAW_DIR}")
    print(f"Classes       : {', '.join(classes)}")
    print(f"Interval      : {args.interval}s   Min change: {args.min_change}")
    print("=" * 60)

    if args.video:
        explicit = [name.strip() for name in (args.classes or "").split(",") if name.strip()]
        if len(explicit) != 1:
            print("[ERROR] --video needs exactly one class, e.g. --classes carrot")
            return 2
        return run_video(args, explicit, saver)

    return run_camera(args, classes, saver)


if __name__ == "__main__":
    sys.exit(main())
