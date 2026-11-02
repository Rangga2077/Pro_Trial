"""Gesture accuracy, frame rate and long-run check against a running CoCI backend.

The script listens to the same WebSocket as the HUD (cv_update messages) and reads
`data.hands`, the raw gesture MediaPipe reports for each visible hand. It does not
change anything in CoCI. Start the backend first (start_app.bat or uvicorn); the
HUD may be open or closed.

    cd backend
    python scripts/verify_gestures.py trials --condition bright --trials 20
    python scripts/verify_gestures.py fps --seconds 60
    python scripts/verify_gestures.py monitor --minutes 60

Results are written to data/test_results/ as CSV files (one row per trial / minute).
"""

import argparse
import asyncio
import csv
import json
import random
import statistics
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

URL = "ws://localhost:8000/ws/"
RESULTS = Path(__file__).resolve().parents[2] / "data" / "test_results"

# (name shown to the tester, hand as reported by CoCI, MediaPipe gesture label)
GESTURES = [
    ("RIGHT index finger up", "Right", "POINTING_UP"),
    ("LEFT index finger up", "Left", "POINTING_UP"),
    ("Closed FIST", "Any", "CLOSED_FIST"),
    ("OPEN PALM", "Any", "OPEN_PALM"),
    ("THUMB UP", "Any", "THUMB_UP"),
    ("BOTH index fingers up", "Both", "POINTING_UP"),
]
# CoCI fires a gesture only after it is held for more than two frames.
MIN_FRAMES = 3


def frame_matches(hands: list[dict], hand: str, gesture: str) -> bool:
    seen = {(h.get("hand"), h.get("gesture")) for h in hands}
    if hand == "Both":
        return ("Left", gesture) in seen and ("Right", gesture) in seen
    if hand == "Any":
        return any(g == gesture for _, g in seen)
    return (hand, gesture) in seen


def judge(frames: list[tuple[float, list[dict]]], hand: str, gesture: str, start: float) -> dict:
    """Recognized = the target is seen in MIN_FRAMES consecutive frames inside the window."""
    run, first = 0, None
    others = Counter()
    for t, hands in frames:
        if frame_matches(hands, hand, gesture):
            run += 1
            if run == MIN_FRAMES and first is None:
                first = t
        else:
            run = 0
            for h in hands:
                if h.get("gesture") not in (None, "UNKNOWN"):
                    others[f'{h.get("hand")}:{h.get("gesture")}'] += 1
    return {
        "recognized": first is not None,
        "time_to_recognize_s": round(first - start, 3) if first is not None else "",
        "frames_in_window": len(frames),
        "most_seen_other": others.most_common(1)[0][0] if others else "",
    }


async def collect(ws, seconds: float) -> list[tuple[float, list[dict]]]:
    """Read cv_update messages for `seconds`; returns (arrival time, hands) per frame."""
    frames = []
    end = time.monotonic() + seconds
    while (left := end - time.monotonic()) > 0:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=left)
        except asyncio.TimeoutError:
            break
        msg = json.loads(raw)
        if msg.get("type") == "cv_update":
            frames.append((time.monotonic(), msg["data"].get("hands") or []))
    return frames


def connect():
    import websockets  # installed with uvicorn[standard]

    return websockets.connect(URL, max_size=None)


def writer(name: str, fields: list[str]):
    RESULTS.mkdir(parents=True, exist_ok=True)
    path = RESULTS / name
    new = not path.exists()
    f = path.open("a", newline="", encoding="utf-8")
    w = csv.DictWriter(f, fieldnames=fields)
    if new:
        w.writeheader()
    return f, w, path


async def trials(args) -> None:
    plan = [g for g in GESTURES for _ in range(args.trials)]
    random.Random(args.seed).shuffle(plan)
    fields = ["timestamp", "tester", "condition", "trial", "gesture", "hand", "recognized",
              "time_to_recognize_s", "frames_in_window", "most_seen_other"]
    f, w, path = writer("gesture_trials.csv", fields)
    hits = Counter()
    async with connect() as ws:
        print(f"Connected. {len(plan)} trials ({args.trials} per gesture), condition '{args.condition}'.")
        print("Lower both hands between trials. Ctrl+C stops; finished trials are already saved.\n")
        for i, (name, hand, gesture) in enumerate(plan, 1):
            print(f"[{i}/{len(plan)}] NEXT: {name}")
            for n in (3, 2, 1):
                print(f"   {n}...")
                await collect(ws, 1.0)
            print("   GO!")
            start = time.monotonic()
            result = judge(await collect(ws, args.window), hand, gesture, start)
            hits[name] += result["recognized"]
            print("   ->", "recognized" if result["recognized"] else f"MISSED (saw: {result['most_seen_other'] or 'nothing'})")
            w.writerow({"timestamp": datetime.now().isoformat(timespec="seconds"), "tester": args.tester,
                        "condition": args.condition, "trial": i, "gesture": gesture,
                        "hand": hand, **result})
            f.flush()
            print("   lower your hands")
            await collect(ws, args.rest)
    f.close()
    print("\nRecognition rate per gesture:")
    total = 0
    for name, _, _ in GESTURES:
        total += hits[name]
        print(f"  {name:24s} {hits[name]:3d}/{args.trials}  ({100 * hits[name] / args.trials:.0f}%)")
    print(f"  {'ALL':24s} {total:3d}/{len(plan)}  ({100 * total / len(plan):.1f}%)")
    print(f"Saved to {path}")


async def fps(args) -> None:
    async with connect() as ws:
        await collect(ws, 2.0)  # settle
        frames = await collect(ws, args.seconds)
    gaps = [b[0] - a[0] for a, b in zip(frames, frames[1:])]
    rate = len(frames) / args.seconds
    print(f"cv_update messages: {len(frames)} in {args.seconds:.0f} s = {rate:.1f} per second")
    if gaps:
        gaps.sort()
        print(f"gap between messages: median {1000 * statistics.median(gaps):.1f} ms, "
              f"95th percentile {1000 * gaps[int(0.95 * (len(gaps) - 1))]:.1f} ms, max {1000 * gaps[-1]:.1f} ms")


async def monitor(args) -> None:
    fields = ["timestamp", "minute", "messages", "per_second", "max_gap_ms", "reconnects"]
    f, w, path = writer("monitor_60min.csv", fields)
    reconnects = 0
    minute = 0
    print(f"Monitoring for {args.minutes} min. Use CoCI normally meanwhile. Ctrl+C stops.")
    while minute < args.minutes:
        try:
            async with connect() as ws:
                while minute < args.minutes:
                    frames = await collect(ws, 60.0)
                    minute += 1
                    gaps = [b[0] - a[0] for a, b in zip(frames, frames[1:])]
                    row = {"timestamp": datetime.now().isoformat(timespec="seconds"), "minute": minute,
                           "messages": len(frames), "per_second": round(len(frames) / 60, 1),
                           "max_gap_ms": round(1000 * max(gaps), 1) if gaps else "", "reconnects": reconnects}
                    w.writerow(row)
                    f.flush()
                    print(row)
        except OSError as error:  # backend went away: count it and retry
            reconnects += 1
            print(f"connection lost ({error}); retrying in 5 s")
            await asyncio.sleep(5)
    f.close()
    print(f"Saved to {path}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="mode", required=True)
    t = sub.add_parser("trials", help="gesture recognition accuracy")
    t.add_argument("--condition", required=True, help="lighting label, e.g. bright or dim")
    t.add_argument("--trials", type=int, default=20, help="trials per gesture")
    t.add_argument("--tester", default="T1")
    t.add_argument("--window", type=float, default=3.0, help="seconds to show the gesture")
    t.add_argument("--rest", type=float, default=2.0, help="seconds with hands lowered")
    t.add_argument("--seed", type=int, default=1)
    s = sub.add_parser("fps", help="cv_update rate (frames per second)")
    s.add_argument("--seconds", type=float, default=60)
    m = sub.add_parser("monitor", help="long-run stability, one CSV row per minute")
    m.add_argument("--minutes", type=int, default=60)
    args = p.parse_args()
    asyncio.run({"trials": trials, "fps": fps, "monitor": monitor}[args.mode](args))


if __name__ == "__main__":
    main()
