"""
auto_label_dataset.py
---------------------
Zero-shot automated dataset labeling & structuring tool for YOLO object detection.
Uses YOLO-World open-vocabulary model to detect objects from custom text prompts,
generates normalized YOLO bounding box label files (.txt), splits dataset into 
80% train / 20% val, and produces dataset.yaml.

Input:
data/dataset/raw_images/{class_name}/clean/

Output:
data/dataset/
├── dataset.yaml
├── images/ (train/ & val/)
└── labels/ (train/ & val/)

Usage:
  python backend/scripts/auto_label_dataset.py
  python backend/scripts/auto_label_dataset.py --conf 0.30 --save-previews
"""

import argparse
import random
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import yaml

try:
    from ultralytics import YOLOWorld
except ImportError:
    print("[ERROR] 'ultralytics' is not installed. Install via: pip install ultralytics")
    sys.exit(1)

# Dynamically resolve project root directory
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Default class mapping for raw folder names to text prompts
DEFAULT_CLASS_MAPPING: Dict[str, str] = {
    "bell_pepper": "bell pepper",
    "carrot": "carrot",
    "chicken_breast_meat": "chicken breast",
    "chicken_egg": "egg",
    "garlic": "garlic bulb",
    "ginger": "ginger root",
    "peanuts": "peanuts",
    "pork_loin": "pork loin",
    "scallion": "scallion green onion",
    "shiitake_mushroom": "shiitake mushroom",
    "soy_sauce": "soy sauce bottle",
    "tofu": "tofu",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Auto-label raw ingredient images and generate YOLO dataset structure."
    )
    parser.add_argument(
        "--raw-dir",
        type=str,
        default="data/dataset/raw_images",
        help="Input raw images directory.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/dataset",
        help="Target YOLO dataset directory.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8s-worldv2.pt",
        help="Pre-trained YOLO-World model (e.g., yolov8s-worldv2.pt, yolov8x-worldv2.pt).",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.30,
        help="Confidence threshold for zero-shot auto-detection (default: 0.30).",
    )
    parser.add_argument(
        "--val-split",
        type=float,
        default=0.20,
        help="Validation dataset split ratio (default: 0.20 for 20%% val / 80%% train).",
    )
    parser.add_argument(
        "--save-previews",
        action="store_true",
        help="Save annotated preview images with drawn bounding boxes for inspection.",
    )
    return parser.parse_args()


def resolve_path(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else PROJECT_ROOT / p


def normalize_box(box_xyxy: Tuple[float, float, float, float], img_w: int, img_h: int) -> Tuple[float, float, float, float]:
    """Converts (x1, y1, x2, y2) to normalized YOLO format (x_center, y_center, width, height)."""
    x1, y1, x2, y2 = box_xyxy
    box_w = x2 - x1
    box_h = y2 - y1
    x_center = x1 + (box_w / 2.0)
    y_center = y1 + (box_h / 2.0)

    return (
        round(x_center / img_w, 6),
        round(y_center / img_h, 6),
        round(box_w / img_w, 6),
        round(box_h / img_h, 6),
    )


def main():
    args = parse_args()
    raw_dir = resolve_path(args.raw_dir)
    output_dir = resolve_path(args.output_dir)

    print("=" * 60)
    print("      YOLO ZERO-SHOT DATASET AUTO-LABELER      ")
    print("=" * 60)
    print(f"Raw Dir       : {raw_dir}")
    print(f"Output Dir    : {output_dir}")
    print(f"YOLO-World    : {args.model}")
    print(f"Confidence    : {args.conf}")
    print(f"Val Split     : {int(args.val_split * 100)}% val / {int((1 - args.val_split) * 100)}% train")
    print("=" * 60)

    if not raw_dir.exists():
        print(f"[ERROR] Raw directory '{raw_dir}' does not exist.")
        return

    # Find all available class subdirectories inside raw_images
    class_folders = [d for d in raw_dir.iterdir() if d.is_dir()]
    if not class_folders:
        print(f"[ERROR] No class directories found in '{raw_dir}'.")
        return

    class_names = sorted([d.name for d in class_folders])
    class_to_id = {name: idx for idx, name in enumerate(class_names)}
    prompt_list = [DEFAULT_CLASS_MAPPING.get(c, c.replace("_", " ")) for c in class_names]

    print(f"\n[INFO] Found {len(class_names)} classes to process:")
    for idx, cname in enumerate(class_names):
        print(f"  ID {idx:2d}: '{cname}' -> Prompt: '{prompt_list[idx]}'")

    # Load YOLO-World model
    print(f"\n[MODEL] Loading YOLO-World zero-shot model '{args.model}'...")
    model = YOLOWorld(args.model)
    model.set_classes(prompt_list)

    # Setup output directory structure
    img_train_dir = output_dir / "images" / "train"
    img_val_dir = output_dir / "images" / "val"
    lbl_train_dir = output_dir / "labels" / "train"
    lbl_val_dir = output_dir / "labels" / "val"
    preview_dir = output_dir / "previews"

    # Clean previous dataset output directories
    for d in [img_train_dir, img_val_dir, lbl_train_dir, lbl_val_dir]:
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True, exist_ok=True)

    if args.save_previews:
        if preview_dir.exists():
            shutil.rmtree(preview_dir)
        preview_dir.mkdir(parents=True, exist_ok=True)

    total_images_processed = 0
    total_labels_written = 0

    for class_folder in class_folders:
        cname = class_folder.name
        cid = class_to_id[cname]

        # Check clean images folder first, fallback to raw folder if clean is empty
        clean_dir = class_folder / "clean"
        img_dir_to_scan = clean_dir if (clean_dir.exists() and any(clean_dir.iterdir())) else class_folder

        img_files = [f for f in img_dir_to_scan.iterdir() if f.is_file() and f.suffix.lower() in [".jpg", ".jpeg", ".png"]]
        if not img_files:
            print(f"  [SKIP] Class '{cname}': No images found in {img_dir_to_scan}")
            continue

        print(f"\n[PROCESSING] Class '{cname}' (ID {cid}) - {len(img_files)} images...")

        # Shuffle for random train/val split
        random.seed(42)
        random.shuffle(img_files)

        num_val = int(len(img_files) * args.val_split)
        val_files = set(img_files[:num_val])

        class_labels_cnt = 0

        for img_path in img_files:
            is_val = img_path in val_files
            dest_img_dir = img_val_dir if is_val else img_train_dir
            dest_lbl_dir = lbl_val_dir if is_val else lbl_train_dir

            # Run zero-shot detection
            results = model.predict(source=str(img_path), conf=args.conf, verbose=False)
            result = results[0]

            img_h, img_w = result.orig_shape[:2]
            label_lines: List[str] = []

            boxes = result.boxes
            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    cls_id_pred = int(box.cls[0].item())
                    # Only accept bounding box if predicted class matches current target class prompt
                    if cls_id_pred == cid:
                        xyxy = box.xyxy[0].tolist()
                        xc, yc, w, h = normalize_box(xyxy, img_w, img_h)
                        label_lines.append(f"{cid} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}")
                        class_labels_cnt += 1

            # Fallback box: if zero-shot detector missed the item, create a centered fallback box (80% of image)
            if not label_lines:
                label_lines.append(f"{cid} 0.500000 0.500000 0.800000 0.800000")
                class_labels_cnt += 1

            # Copy image to destination dataset folder
            target_img_name = f"{cname}_{img_path.name}"
            target_img_path = dest_img_dir / target_img_name
            shutil.copy2(img_path, target_img_path)

            # Write matching YOLO label .txt file
            target_lbl_name = f"{cname}_{img_path.stem}.txt"
            target_lbl_path = dest_lbl_dir / target_lbl_name
            with open(target_lbl_path, "w", encoding="utf-8") as f:
                f.write("\n".join(label_lines) + "\n")

            # Save annotated preview if requested
            if args.save_previews and boxes is not None and len(boxes) > 0:
                preview_path = preview_dir / f"preview_{target_img_name}"
                res_plotted = result.plot()
                cv2.imwrite(str(preview_path), res_plotted)

            total_images_processed += 1

        total_labels_written += class_labels_cnt
        print(f"  -> Finished '{cname}': {len(img_files)} images split ({len(img_files) - num_val} train, {num_val} val), {class_labels_cnt} boxes written.")

    # Auto-generate dataset.yaml
    yaml_content = {
        "path": str(output_dir.resolve()),
        "train": "images/train",
        "val": "images/val",
        "names": {idx: cname for idx, cname in enumerate(class_names)},
    }
    dataset_yaml_path = output_dir / "dataset.yaml"
    with open(dataset_yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(yaml_content, f, sort_keys=False)

    print("\n" + "=" * 60)
    print("                AUTO-LABELING SUMMARY REPORT                 ")
    print("=" * 60)
    print(f"Total Images Processed : {total_images_processed}")
    print(f"Total Boxes Written    : {total_labels_written}")
    print(f"Dataset YAML File      : {dataset_yaml_path.resolve()}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
