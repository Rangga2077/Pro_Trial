import cv2
import mediapipe as mp
import numpy as np
import os
import time
import urllib.request
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from pathlib import Path

class GestureRecognizer:
    def __init__(self):
        self.running = False
        self.latest_gestures = []
        self.latest_landmarks = []
        
        try:
            weights_dir = Path(__file__).parent / "weights"
            weights_dir.mkdir(parents=True, exist_ok=True)
            self.model_path = str(weights_dir / "gesture_recognizer.task")
            
            if not os.path.exists(self.model_path):
                print("Downloading gesture_recognizer.task...")
                urllib.request.urlretrieve(
                    "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                    self.model_path
                )
            
            BaseOptions = mp.tasks.BaseOptions
            GestureRecognizer_ = mp.tasks.vision.GestureRecognizer
            GestureRecognizerOptions = mp.tasks.vision.GestureRecognizerOptions
            VisionRunningMode = mp.tasks.vision.RunningMode

            options = GestureRecognizerOptions(
                base_options=BaseOptions(model_asset_path=self.model_path),
                running_mode=VisionRunningMode.LIVE_STREAM,
                num_hands=2,
                min_hand_detection_confidence=0.5,
                min_hand_presence_confidence=0.5,
                min_tracking_confidence=0.5,
                result_callback=self._result_callback
            )
            
            self.recognizer = GestureRecognizer_.create_from_options(options)
            print("GestureRecognizer: Initialized (LIVE_STREAM mode)")
            self.running = True
        except Exception as e:
            print(f"GestureRecognizer Error: {e}")
            self.recognizer = None

    def _result_callback(self, result: vision.GestureRecognizerResult, output_image: mp.Image, timestamp_ms: int):
        gestures = []
        visualization_data = []

        if result.hand_landmarks and result.gestures:
            for i, hand_landmarks in enumerate(result.hand_landmarks):
                # Get handedness
                handedness = "Unknown"
                if result.handedness and i < len(result.handedness):
                    handedness = result.handedness[i][0].category_name

                # Get the top gesture
                gesture_name = "UNKNOWN"
                if result.gestures and i < len(result.gestures) and len(result.gestures[i]) > 0:
                    top_gesture = result.gestures[i][0]
                    # Filter out low-confidence "None" gestures
                    if top_gesture.category_name != "None" and top_gesture.score > 0.5:
                        gesture_name = top_gesture.category_name.upper()

                gestures.append({
                    "hand": handedness,
                    "gesture": gesture_name
                })
                visualization_data.append((hand_landmarks, result.hand_world_landmarks[i] if result.hand_world_landmarks else None))

        self.latest_gestures = gestures
        self.latest_landmarks = visualization_data

    def recognize(self, frame):
        """
        Feeds frame to LIVE_STREAM async recognizer.
        Returns the **LATEST AVAILABLE** gestures without blocking.
        """
        if not self.running or self.recognizer is None:
            return [], []

        try:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            # Feed async, this requires a strictly increasing timestamp in ms
            timestamp_ms = int(time.time() * 1000)
            self.recognizer.recognize_async(mp_image, timestamp_ms)
            
            # Since recognize_async is non-blocking, we just return whatever the callback stored last.
            # Convert visualization_data format to match old output (list of hand_landmarks)
            landmarks_only = [lm_tup[0] for lm_tup in self.latest_landmarks] if self.latest_landmarks else []
            return self.latest_gestures, landmarks_only

        except Exception as e:
            # Drop frame errors (usually timestamp issues if time backwards/equals)
            pass
            return self.latest_gestures, [lm_tup[0] for lm_tup in self.latest_landmarks] if self.latest_landmarks else []


gesture_recognizer = GestureRecognizer()

def draw_landmarks_on_image(rgb_image, hand_landmarks):
    h, w, _ = rgb_image.shape
    
    # Define connections (MediaPipe Hands)
    calc_connections = [
        (0,1), (1,2), (2,3), (3,4),       # Thumb
        (0,5), (5,6), (6,7), (7,8),       # Index
        (9,10), (10,11), (11,12),         # Middle
        (13,14), (14,15), (15,16),        # Ring
        (17,18), (18,19), (19,20),        # Pinky
        (0,17), (0,13), (0,9), (0,5)      # Palm roots
    ]
    
    # Draw points
    for landmark in hand_landmarks:
        cx, cy = int(landmark.x * w), int(landmark.y * h)
        cv2.circle(rgb_image, (cx, cy), 5, (0, 0, 255), -1)

    # Draw lines
    lms = hand_landmarks
    for start_idx, end_idx in calc_connections:
        start = lms[start_idx]
        end = lms[end_idx]
        
        start_pt = (int(start.x * w), int(start.y * h))
        end_pt = (int(end.x * w), int(end.y * h))
        
        cv2.line(rgb_image, start_pt, end_pt, (0, 255, 0), 2)

def main():
    print("Initializing GestureRecognizer (LIVE_STREAM)...")
    recognizer = GestureRecognizer()
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    print("Started. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        gestures, visualization_data = recognizer.recognize(frame)

        if visualization_data:
            for hand_landmarks in visualization_data:
                draw_landmarks_on_image(frame, hand_landmarks)

        if gestures:
            text = f"Gesture: {gestures[0]['gesture']} ({gestures[0]['hand']})"
            color = (0, 255, 0)
            cv2.putText(frame, text, (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
        else:
            cv2.putText(frame, "Gesture: NONE", (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        cv2.imshow("MediaPipe LIVE_STREAM Gesture Test", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
