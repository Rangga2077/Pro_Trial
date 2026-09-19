"""
train_yolo.py
-------------
One-click local YOLO model training launcher optimized for NVIDIA GPUs (RTX 3050).
Loads dataset config (data/dataset/dataset.yaml), trains specified model (yolov10n.pt),
and automatically copies trained best.pt weights into app weights directory.

Usage:
  python backend/scripts/train_yolo.py --epochs 50 --batch 16
  python backend/scripts/train_yolo.py --epochs 50 --model yolov10n.pt --workers 0
"""

import argparse
import shutil
import sys
from pathlib import Path

import torch
try:
    from ultralytics import YOLO
except ImportError:
    print("[ERROR] 'ultralytics' package not found. Install via: pip install ultralytics")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train local YOLO model on RTX 3050 GPU for ingredient detection."
    )
    parser.add_argument(
        "--data",
        type=str,
        default="data/dataset/dataset.yaml",
        help="Path to dataset.yaml configuration file.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="yolov10n.pt",
        help="Base pre-trained YOLO model (default: yolov10n.pt).",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=50,
        help="Number of training epochs (default: 50).",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=16,
        help="Batch size (default: 16, optimized for 4GB RTX 3050 VRAM).",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Image size in pixels (default: 640).",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="0" if torch.cuda.is_available() else "cpu",
        help="Training compute device ('0' for RTX 3050 GPU, 'cpu' for CPU).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=0,
        help="DataLoader worker subprocesses (default: 0 to prevent Windows WinError 1455 paging memory errors).",
    )
    parser.add_argument(
        "--project",
        type=str,
        default="data/runs",
        help="Directory to save training logs and checkpoints.",
    )
    parser.add_argument(
        "--name",
        type=str,
        default="ingredient_model",
        help="Name of the training run directory.",
    )
    parser.add_argument(
        "--target-weights",
        type=str,
        default="backend/app/engines/cv/weights/custom_ingredients.pt",
        help="Target app weights file destination.",
    )
    return parser.parse_args()


def resolve_path(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else PROJECT_ROOT / p


def main():
    args = parse_args()
    data_yaml = resolve_path(args.data)
    project_dir = resolve_path(args.project)
    target_weights = resolve_path(args.target_weights)

    print("=" * 60)
    print("      LOCAL YOLO MODEL TRAINING (RTX 3050 GPU)      ")
    print("=" * 60)
    print(f"Dataset Config   : {data_yaml}")
    print(f"Base Model       : {args.model}")
    print(f"Epochs           : {args.epochs}")
    print(f"Batch Size       : {args.batch}")
    print(f"Image Size       : {args.imgsz} px")
    print(f"Compute Device   : {args.device} ({'GPU: ' + torch.cuda.get_device_name(0) if args.device != 'cpu' else 'CPU'})")
    print(f"DataLoader Workers: {args.workers} (Windows-safe)")
    print(f"Project Output   : {project_dir}")
    print("=" * 60)

    if not data_yaml.exists():
        print(f"[ERROR] Dataset configuration file '{data_yaml}' not found.")
        print("Run 'python backend/scripts/auto_label_dataset.py' first to prepare dataset.")
        return

    # Load base model
    print(f"\n[MODEL] Loading base model '{args.model}'...")
    model = YOLO(args.model)

    # Launch training
    print("\n[TRAIN] Starting YOLO training pipeline...")
    results = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device,
        workers=args.workers,
        project=str(project_dir),
        name=args.name,
        exist_ok=True,
    )

    # Locate best.pt
    run_dir = project_dir / args.name
    best_weights = run_dir / "weights" / "best.pt"

    print("\n" + "=" * 60)
    print("                 TRAINING COMPLETE REPORT                 ")
    print("=" * 60)
    print(f"Run Output Dir   : {run_dir.resolve()}")
    
    if best_weights.exists():
        print(f"Best Weights Pt  : {best_weights.resolve()}")
        # Copy to app weights directory
        target_weights.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best_weights, target_weights)
        print(f"Deployed Weights : {target_weights.resolve()} [READY]")
    else:
        print("[WARNING] Could not locate best.pt weights file.")

    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
