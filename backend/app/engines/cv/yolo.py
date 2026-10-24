from ultralytics import YOLO
import cv2
import numpy as np
import os
from pathlib import Path

class YOLOModel:
    def __init__(self, model_name="custom_ingredients.pt"):
        # Create strict absolute path
        weights_dir = Path(__file__).parent / "weights"
        weights_dir.mkdir(parents=True, exist_ok=True)
        
        custom_path = weights_dir / "custom_ingredients.pt"
        default_path = weights_dir / "yolov10n.pt"

        if custom_path.exists():
            self.model_path = str(custom_path)
        else:
            self.model_path = str(default_path)
        
        # Auto-download if not found into specific path
        try:
            self.model = YOLO(self.model_path) 
            print(f"YOLO model loaded: {self.model_path}")
        except Exception as e:
            print(f"Failed to load YOLO model: {e}")
            self.model = None

    def track(self, frame):
        if self.model is None:
            return []
            
        # Run tracking (ByteTrack)
        results = self.model.track(frame, persist=True, tracker="bytetrack.yaml", verbose=False)
        
        detections = []
        for result in results:
            for box in result.boxes:
                # Extract coordinates, class, and track ID
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = box.conf[0].item()
                cls = int(box.cls[0].item())
                label = self.model.names[cls]
                track_id = int(box.id[0].item()) if box.id is not None else -1
                
                # Filter out person detection as requested
                if label.lower() == 'person':
                    continue
                    
                detections.append({
                    "bbox": [x1, y1, x2, y2],
                    "confidence": conf,
                    "label": label,
                    "track_id": track_id
                })
        return detections

yolo_model = YOLOModel()
