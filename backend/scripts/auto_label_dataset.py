"""
auto_label_dataset.py
---------------------
Zero-shot auto-labeler for the ingredient detector. YOLO-World draws draft boxes
for the recorded frames, using the prompts in ingredient_classes.py.

Class IDs come from ingredient_classes.CLASSES (never from folder order), so a
class added later never renumbers the others. Background frames get empty labels.

Input:
data/dataset/raw_images/<class>/clean/*.jpg
data/dataset/raw_images/background/clean/*.jpg

Output:
data/dataset/
├── dataset.yaml        (all CLASSES, in ID order)
├── classes.txt         (labeling tools)
├── needs_review.txt    (frames with no detection, when --no-fallback)
├── images/ (train/ & val/)
└── labels/ (train/ & val/)

Usage:
  python backend/scripts/auto_label_dataset.py --val-session 20261016-val --no-fallback
  python backend/scripts/auto_label_dataset.py --val-session 20261016-val --no-fallback --force
"""

import argparse
import random
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Set

import cv2
import yaml

try:
    from ultralytics import YOLOWorld
except ImportError:
    print("[ERROR] 'ultralytics' is not installed. Install via: pip install ultralytics")
    sys.exit(1)

from ingredient_classes import BACKGROUND, CLASS_TO_ID, CLASSES, PROMPTS  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parents[2]
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
FALLBACK_BOX = (0.5, 0.5, 0.8, 0.8)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Auto-label recorded ingredient frames and build the YOLO dataset."
    )
    parser.add_argument("--raw-dir", type=str, default="data/dataset/raw_images", help="Input raw images directory.")
    parser.add_argument("--output-dir", type=str, default="data/dataset", help="Target YOLO dataset directory.")
    parser.add_argument(
        "--model",
        type=str,
        default="backend/yolov8s-worldv2.pt",
        help="YOLO-World weights. The default is the local file, so nothing is downloaded.",
    )
    parser.add_argument("--conf", type=float, default=0.30, help="Detection confidence threshold (default: 0.30).")
    parser.add_argument(
        "--val-split",
        type=float,
        default=0.20,
        help="Random val fraction, used only when no --val-session is given (default: 0.20).",
    )
    parser.add_argument(
        "--val-session",
        action="append",
        default=[],
        metavar="ID",
        help="Frames whose file name starts with ID go to val, everything else to train. Repeatable.",
    )
    parser.add_argument(
        "--no-fallback",
        action="store_true",
        help="Write an empty label when nothing is detected (instead of a centred box) and list the frame in needs_review.txt.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace an existing dataset. Refused while labels/.reviewed exists unless --force is given.",
    )
    parser.add_argument("--save-previews", action="store_true", help="Save annotated previews for inspection.")
    return parser.parse_args()


def resolve_path(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else PROJECT_ROOT / p


def normalize_box(box_xyxy, img_w: int, img_h: int):
    """Converts (x1, y1, x2, y2) to normalized YOLO format (x_center, y_center, width, height)."""
    x1, y1, x2, y2 = box_xyxy
    box_w = x2 - x1
    box_h = y2 - y1
    return (
        round((x1 + box_w / 2.0) / img_w, 6),
        round((y1 + box_h / 2.0) / img_h, 6),
        round(box_w / img_w, 6),
        round(box_h / img_h, 6),
    )


def collect_images(raw_dir: Path) -> Dict[str, List[Path]]:
    """Returns {class name: sorted frame paths} for known classes that have images."""
    found: Dict[str, List[Path]] = {}
    for folder in sorted(p for p in raw_dir.iterdir() if p.is_dir()):
        if folder.name != BACKGROUND and folder.name not in CLASS_TO_ID:
            print(f"[WARN] Skipping '{folder.name}': not in ingredient_classes.CLASSES")
            continue
        clean = folder / "clean"
        files = sorted(f for f in clean.glob("*") if f.suffix.lower() in IMAGE_EXTS) if clean.exists() else []
        if not files:
            print(f"[SKIP] '{folder.name}': no images in {clean}")
            continue
        found[folder.name] = files
    return found


def pick_val(files: List[Path], val_sessions: List[str], val_split: float) -> Set[Path]:
    if val_sessions:
        return {f for f in files if any(f.name.startswith(s) for s in val_sessions)}
    shuffled = list(files)
    random.Random(42).shuffle(shuffled)
    return set(shuffled[: int(len(shuffled) * val_split)])


def main() -> int:
    args = parse_args()
    raw_dir = resolve_path(args.raw_dir)
    output_dir = resolve_path(args.output_dir)
    img_root = output_dir / "images"
    lbl_root = output_dir / "labels"
    lock_file = lbl_root / ".reviewed"

    print("=" * 60)
    print("      YOLO ZERO-SHOT DATASET AUTO-LABELER      ")
    print("=" * 60)
    print(f"Raw Dir       : {raw_dir}")
    print(f"Output Dir    : {output_dir}")
    print(f"YOLO-World    : {args.model}")
    print(f"Confidence    : {args.conf}")
    print(f"Val sessions  : {', '.join(args.val_session) or f'random {args.val_split:.0%}'}")
    print(f"No fallback   : {args.no_fallback}")
    print("=" * 60)

    if not raw_dir.exists():
        print(f"[ERROR] Raw directory '{raw_dir}' does not exist.")
        return 1

    # Protect reviewed labels: nothing is deleted without --force.
    if lock_file.exists() and not args.force:
        print(f"[REFUSED] {lock_file} exists: the labels were reviewed.")
        print("          Back up data/dataset first, then re-run with --force (see guide section 12).")
        return 1
    if (img_root.exists() or lbl_root.exists()) and not args.force:
        print(f"[REFUSED] {img_root} or {lbl_root} already exists.")
        print("          Re-run with --force to regenerate the dataset.")
        return 1

    found = collect_images(raw_dir)
    trained = [c for c in found if c != BACKGROUND]
    if not trained:
        print("[ERROR] No trained class has images. Record frames first (record_ingredient_frames.py).")
        return 1

    # Prompt only the classes that have frames, in fixed ID order.
    prompt_classes = [c for c in CLASSES if c in trained]
    prompt_index_to_class = dict(enumerate(prompt_classes))
    print(f"\n[INFO] Trained classes ({len(prompt_classes)}), fixed IDs:")
    for c in prompt_classes:
        print(f"  ID {CLASS_TO_ID[c]:2d}: '{c}' -> prompt: '{PROMPTS[c]}'")

    model_path = resolve_path(args.model)
    print(f"\n[MODEL] Loading YOLO-World '{args.model}'...")
    model = YOLOWorld(str(model_path) if model_path.exists() else args.model)
    model.set_classes([PROMPTS[c] for c in prompt_classes])

    if args.force:
        for d in (img_root, lbl_root):
            if d.exists():
                shutil.rmtree(d)
    for sub in ("train", "val"):
        (img_root / sub).mkdir(parents=True, exist_ok=True)
        (lbl_root / sub).mkdir(parents=True, exist_ok=True)
    preview_dir = output_dir / "previews"
    if args.save_previews:
        if preview_dir.exists():
            shutil.rmtree(preview_dir)
        preview_dir.mkdir(parents=True, exist_ok=True)

    counts: Dict[str, Dict[str, int]] = {c: {"train": 0, "val": 0} for c in found}
    boxes_per_class: Dict[str, int] = {c: 0 for c in found}
    review_names: List[str] = []

    for cname, files in found.items():
        val_files = pick_val(files, args.val_session, args.val_split)
        print(f"\n[PROCESSING] '{cname}' - {len(files)} frames ({len(val_files)} val)")

        for img_path in files:
            split = "val" if img_path in val_files else "train"
            counts[cname][split] += 1
            target_name = f"{cname}_{img_path.name}"
            label_lines: List[str] = []

            if cname == BACKGROUND:
                # Background frames contain no trained class: empty label, no detection.
                shutil.copy2(img_path, img_root / split / target_name)
                (lbl_root / split / f"{cname}_{img_path.stem}.txt").write_text("", encoding="utf-8")
                continue

            result = model.predict(source=str(img_path), conf=args.conf, verbose=False)[0]
            img_h, img_w = result.orig_shape[:2]
            if result.boxes is not None:
                for box in result.boxes:
                    det_class = prompt_index_to_class[int(box.cls[0].item())]
                    xc, yc, w, h = normalize_box(box.xyxy[0].tolist(), img_w, img_h)
                    label_lines.append(f"{CLASS_TO_ID[det_class]} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}")
                    boxes_per_class[det_class] += 1

            if not label_lines:
                if args.no_fallback:
                    review_names.append(target_name)
                else:
                    x, y, w, h = FALLBACK_BOX
                    label_lines.append(f"{CLASS_TO_ID[cname]} {x:.6f} {y:.6f} {w:.6f} {h:.6f}")
                    boxes_per_class[cname] += 1

            shutil.copy2(img_path, img_root / split / target_name)
            (lbl_root / split / f"{cname}_{img_path.stem}.txt").write_text("\n".join(label_lines) + "\n" if label_lines else "", encoding="utf-8")

            if args.save_previews and result.boxes is not None and len(result.boxes) > 0:
                cv2.imwrite(str(preview_dir / f"preview_{target_name}"), result.plot())

    # dataset.yaml always lists every class in ID order, even ones with no frames yet.
    dataset_yaml = output_dir / "dataset.yaml"
    yaml_content = {
        "path": str(output_dir.resolve()),
        "train": "images/train",
        "val": "images/val",
        "names": {idx: name for idx, name in enumerate(CLASSES)},
    }
    with open(dataset_yaml, "w", encoding="utf-8") as f:
        yaml.dump(yaml_content, f, sort_keys=False)

    (output_dir / "classes.txt").write_text("\n".join(CLASSES) + "\n", encoding="utf-8")
    (output_dir / "needs_review.txt").write_text("\n".join(review_names) + ("\n" if review_names else ""), encoding="utf-8")

    print("\n" + "=" * 60)
    print("                AUTO-LABELING SUMMARY                ")
    print("=" * 60)
    print(f"{'class':<22}{'train':>7}{'val':>6}{'boxes':>8}")
    for c in found:
        if c == BACKGROUND:
            continue
        print(f"{c:<22}{counts[c]['train']:>7}{counts[c]['val']:>6}{boxes_per_class[c]:>8}")
        if counts[c]["val"] == 0:
            print(f"  [WARN] '{c}' has 0 val frames: its metrics will be missing.")
    if BACKGROUND in found:
        print(f"{BACKGROUND:<22}{counts[BACKGROUND]['train']:>7}{counts[BACKGROUND]['val']:>6}{'-':>8}")
    print(f"\nNeeds review (no detection): {len(review_names)}")
    print(f"dataset.yaml : {dataset_yaml.resolve()}")
    print(f"classes.txt  : {(output_dir / 'classes.txt').resolve()}")
    print("=" * 60 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
