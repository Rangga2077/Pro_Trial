import cv2
import mediapipe as mp
import numpy as np
import os
import time

class GestureRecognizer:
    def __init__(self):
        try:
            self.model_path = os.path.join(os.getcwd(), 'backend', 'hand_landmarker.task')
            if not os.path.exists(self.model_path):
                # Fallback check if running from backend root
                self.model_path = 'hand_landmarker.task'
            
            BaseOptions = mp.tasks.BaseOptions
            HandLandmarker = mp.tasks.vision.HandLandmarker
            HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
            VisionRunningMode = mp.tasks.vision.RunningMode

            options = HandLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=self.model_path),
                running_mode=VisionRunningMode.IMAGE, # IMAGE mode is simpler for now
                num_hands=2,
                min_hand_detection_confidence=0.5,
                min_hand_presence_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            self.landmarker = HandLandmarker.create_from_options(options)
            print("GestureRecognizer: Initialized (MediaPipe Tasks API)")
            self.running = True
        except Exception as e:
            print(f"GestureRecognizer: Error initializing MediaPipe Tasks - {e}")
            self.landmarker = None
            self.running = False

    def recognize(self, frame):
        """
        Recognizes hand gestures using MediaPipe Tasks API.
        Returns:
            gestures (list): List of detected gesture names
            landmarks (list): List of list of landmarks (dictionaries with x,y,z)
        """
        if not self.running or self.landmarker is None:
            return [], []

        try:
            # MediaPipe Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            
            # Detect
            detection_result = self.landmarker.detect(mp_image)
            
            gestures = []
            visualization_data = [] # List of NormalizedLandmark lists

            # Process results
            if detection_result.hand_landmarks:
                for hand_landmarks in detection_result.hand_landmarks:
                    # hand_landmarks is a list of NormalizedLandmark objects
                    
                    # Analyze gestures
                    gesture = self.analyze_gesture_task(hand_landmarks)
                    if gesture != "UNKNOWN":
                        gestures.append(gesture)
                    
                    # Store for viz
                    visualization_data.append(hand_landmarks)

            return gestures, visualization_data

        except Exception as e:
            print(f"Gesture Algo Error: {e}")
            return [], []

    def analyze_gesture_task(self, landmarks):
        """
        Analyze MediaPipe landmarks (Tasks API).
        landmarks: list of NormalizedLandmark objects (x, y, z)
        """
        # Convert to list of dicts or just access directly
        # lms[i].x, lms[i].y
        
        # Helper: extended?
        # Index (8) Tip Y < PIP (6) Y
        index_ext = landmarks[8].y < landmarks[6].y
        middle_ext = landmarks[12].y < landmarks[10].y
        ring_ext = landmarks[16].y < landmarks[14].y
        pinky_ext = landmarks[20].y < landmarks[18].y
        
        # Thumb heuristic: Tip x/y logic is tricky.
        # Let's count fingers
        finger_count = 0
        if index_ext: finger_count += 1
        if middle_ext: finger_count += 1
        if ring_ext: finger_count += 1
        if pinky_ext: finger_count += 1
        
        # OPEN_PALM: 4 fingers up
        if finger_count >= 4:
            return "OPEN_PALM"
            
        # POINTING: Index up, others down
        if index_ext and (not middle_ext) and (not ring_ext) and (not pinky_ext):
            return "POINTING"
            
        return "UNKNOWN"

gesture_recognizer = GestureRecognizer()

def draw_landmarks_on_image(rgb_image, hand_landmarks):
    """
    Custom drawing function since mp.solutions.drawing_utils is missing.
    hand_landmarks: list of NormalizedLandmark
    """
    h, w, _ = rgb_image.shape
    
    # Define connections (MediaPipe Hands)
    calc_connections = [
        (0,1), (1,2), (2,3), (3,4),       # Thumb
        (0,5), (5,6), (6,7), (7,8),       # Index
        (9,10), (10,11), (11,12),         # Middle (Root 9 connects to 0 usually, but in MP graph it varies)
        (13,14), (14,15), (15,16),        # Ring
        (17,18), (18,19), (19,20),        # Pinky
        (0,17), (0,13), (0,9), (0,5)      # Palm roots
    ]
    
    # Draw points
    for landmark in hand_landmarks:
        cx, cy = int(landmark.x * w), int(landmark.y * h)
        cv2.circle(rgb_image, (cx, cy), 5, (0, 0, 255), -1)

    # Draw lines
    # Need random access to landmarks
    lms = hand_landmarks
    for start_idx, end_idx in calc_connections:
        start = lms[start_idx]
        end = lms[end_idx]
        
        start_pt = (int(start.x * w), int(start.y * h))
        end_pt = (int(end.x * w), int(end.y * h))
        
        cv2.line(rgb_image, start_pt, end_pt, (0, 255, 0), 2)

def main():
    print("Initializing GestureRecognizer (Tasks API)...")
    recognizer = GestureRecognizer()
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    print("Starting interactive test. Press 'q' to quit.")
    print("---------------------------------------------")
    print("GESTURE GUIDE:")
    print(" - OPEN_PALM: Extend all 5 fingers.")
    print(" - POINTING: Extend only Index finger.")
    print("---------------------------------------------")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        gestures, visualization_data = recognizer.recognize(frame)

        # Draw overlays
        # visualization_data is list of lists of NormalizedLandmark
        if visualization_data:
            for hand_landmarks in visualization_data:
                draw_landmarks_on_image(frame, hand_landmarks)
                
                # Debug check: verify we have 21 points
                num_points = len(hand_landmarks)
                cv2.putText(frame, f"Points: {num_points}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # Draw Gesture Text
        if gestures:
            text = f"Gesture: {gestures[0]}"
            color = (0, 255, 0) # Green
        else:
            text = "Gesture: NONE"
            color = (0, 0, 255) # Red

        cv2.putText(frame, text, (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

        cv2.imshow("MediaPipe Tasks Gesture Test", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
