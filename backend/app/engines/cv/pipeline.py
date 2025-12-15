import cv2
import asyncio
import base64
from app.api.v1.endpoints.stream import manager
from app.engines.cv.yolo import yolo_model
from app.engines.cv.gesture import gesture_recognizer

class CVPipeline:
    def __init__(self):
        self.running = False
        self.cap = None

    async def start(self):
        self.running = True
        self.cap = cv2.VideoCapture(0) # 0 for default camera
        
        if not self.cap.isOpened():
            print("Error: Could not open camera.")
            self.running = False
            return

        print("CV Pipeline started.")
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                break

            # 1. Object Detection
            detections = yolo_model.predict(frame)
            
            # 2. Gesture Recognition
            gestures, landmarks = gesture_recognizer.recognize(frame)
            
            # 3. Encode frame for frontend (optional, if we want to stream video)
            _, buffer = cv2.imencode('.jpg', frame)
            frame_b64 = base64.b64encode(buffer).decode('utf-8')

            # Broadcast data
            await manager.broadcast_json({
                "type": "cv_update",
                "data": {
                    "objects": detections,
                    "gestures": gestures,
                    "frame": frame_b64 # Uncomment if streaming video
                }
            })
            
            # Debug Log
            if gestures and gestures[0] != "UNKNOWN":
                print(f"Gesture Detected: {gestures[0]}")

            
            # Control FPS (approx 30 FPS)
            await asyncio.sleep(0.03)

        self.cap.release()
        print("CV Pipeline stopped.")

    def stop(self):
        self.running = False

cv_pipeline = CVPipeline()
