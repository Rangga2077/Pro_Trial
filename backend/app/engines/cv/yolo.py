from ultralytics import YOLO
import cv2
import numpy as np

class YOLOModel:
    def __init__(self, model_path="yolov10n.pt"):
        # Auto-download if not found
        try:
            self.model = YOLO(model_path) 
            print(f"YOLO model loaded: {model_path}")
        except Exception as e:
            print(f"Failed to load YOLO model: {e}")
            self.model = None

    def predict(self, frame):
        if self.model is None:
            return []
            
        # Run inference
        results = self.model(frame, verbose=False)
        
        detections = []
        for result in results:
            for box in result.boxes:
                # Extract coordinates and class
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = box.conf[0].item()
                cls = int(box.cls[0].item())
                label = self.model.names[cls]
                
                detections.append({
                    "bbox": [x1, y1, x2, y2],
                    "confidence": conf,
                    "label": label
                })
        return detections

yolo_model = YOLOModel()
