import cv2
import asyncio
import base64
import threading
import time
from app.api.v1.endpoints.stream import manager
from app.engines.cv.yolo import yolo_model
from app.engines.cv.gesture import gesture_recognizer, draw_landmarks_on_image
from app.core.config import settings

class ThreadedCamera:
    def __init__(self, src=0, width=1280, height=720):
        # Use DSHOW on Windows for faster initialization and robust handling
        self.cap = cv2.VideoCapture(src, cv2.CAP_DSHOW) if cv2.os.name == 'nt' else cv2.VideoCapture(src)
        if self.cap.isOpened():
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) # Get the freshest frame
        
        self.ret, self.frame = self.cap.read()
        self.running = True
        self.thread = threading.Thread(target=self.update, args=())
        self.thread.daemon = True
        if self.cap.isOpened():
            self.thread.start()

    def update(self):
        while self.running:
            if self.cap.isOpened():
                self.ret, self.frame = self.cap.read()
            else:
                time.sleep(0.01)

    def read(self):
        # Copy to avoid race condition if thread writes while reading
        return self.ret, self.frame.copy() if self.frame is not None else None

    def release(self):
        self.running = False
        if self.thread.is_alive():
            self.thread.join()
        self.cap.release()

class CVPipeline:
    def __init__(self):
        self.running = False
        self.camera = None

    async def start(self):
        self.running = True
        self.camera = ThreadedCamera(src=settings.CAMERA_INDEX, width=settings.CAMERA_WIDTH, height=settings.CAMERA_HEIGHT)
        
        if not self.camera.cap.isOpened():
            print(f"Error: Could not open camera {settings.CAMERA_INDEX}.")
            self.running = False
            return

        print(f"CV Pipeline started. Camera Index: {settings.CAMERA_INDEX} @ {settings.CAMERA_WIDTH}x{settings.CAMERA_HEIGHT}")
        
        while self.running:
            ret, frame = self.camera.read()
            if not ret or frame is None:
                await asyncio.sleep(0.01)
                continue
            
            try:
                # 1. Object Detection (ByteTrack)
                detections = yolo_model.track(frame)
                
                # 2. Gesture Recognition
                # Using LIVE_STREAM, this returns the immediately available async results
                gestures, landmarks = gesture_recognizer.recognize(frame)
                
                # 3. Draw Annotations on Frame
                if landmarks:
                    for hand_landmarks in landmarks:
                        draw_landmarks_on_image(frame, hand_landmarks)
                
                if gestures:
                    text = f"Gesture: {gestures[0]['gesture']} ({gestures[0]['hand']})"
                    cv2.putText(frame, text, (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                if detections:
                    for obj in detections:
                        # Exclude person handled in YOLO class, but double check
                        if obj['label'].lower() == 'person':
                            continue
                        x1, y1, x2, y2 = map(int, obj['bbox'])
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        
                        id_text = f" #{obj.get('track_id', '?')}" if obj.get('track_id', -1) != -1 else ""
                        label_str = f"{obj['label']}{id_text} {obj['confidence']:.2f}"
                        cv2.putText(frame, label_str, (x1, max(y1-10, 0)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                # 4. Encode frame for frontend
                _, buffer = cv2.imencode('.jpg', frame)
                frame_b64 = base64.b64encode(buffer).decode('utf-8')

                # Broadcast data
                await manager.broadcast_json({
                    "type": "cv_update",
                    "data": {
                        "objects": detections,
                        "gestures": gestures,
                        "frame": frame_b64
                    }
                })
            
            except Exception as e:
                print(f"Error in CV Pipeline loop: {e}")

            # Control FPS parsing pacing (backend broadcasting pacing)
            await asyncio.sleep(0.03)

        self.camera.release()
        print("CV Pipeline stopped.")

    def stop(self):
        self.running = False
        if self.camera:
            self.camera.release()

cv_pipeline = CVPipeline()
