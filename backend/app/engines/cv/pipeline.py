import cv2
import asyncio
import base64
from app.api.v1.endpoints.stream import manager
from app.engines.cv.yolo import yolo_model
from app.engines.cv.gesture import gesture_recognizer, draw_landmarks_on_image

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
            
            try:
                # 1. Object Detection
                detections = yolo_model.predict(frame)
                
                # 2. Gesture Recognition
                gestures, landmarks = gesture_recognizer.recognize(frame)
                
                # 3. Draw Annotations on Frame
                # Draw hand landmarks
                if landmarks:
                    for hand_landmarks in landmarks:
                        draw_landmarks_on_image(frame, hand_landmarks)
                
                # Draw recognized gestures
                if gestures:
                    text = f"Gesture: {gestures[0]['gesture']} ({gestures[0]['hand']} Hand)"
                    cv2.putText(frame, text, (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                # Draw object detections (excluding 'person' as requested previously)
                if detections:
                    for obj in detections:
                        if obj['label'].lower() == 'person':
                            continue
                        x1, y1, x2, y2 = map(int, obj['bbox'])
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(frame, f"{obj['label']} {obj['confidence']:.2f}", (x1, max(y1-10, 0)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                # 4. Encode frame for frontend
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
                if gestures and gestures[0].get('gesture') != "UNKNOWN":
                    print(f"Gesture Detected: {gestures[0]}")
            
            except Exception as e:
                print(f"Error in CV Pipeline loop: {e}")

            
            # Control FPS (approx 30 FPS)
            await asyncio.sleep(0.03)

        self.cap.release()
        print("CV Pipeline stopped.")

    def stop(self):
        self.running = False

cv_pipeline = CVPipeline()
