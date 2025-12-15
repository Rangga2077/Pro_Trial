import cv2
import numpy as np
import math

class GestureRecognizer:
    def __init__(self):
        print("GestureRecognizer: Initialized (OpenCV Native)")

    def recognize(self, frame):
        """
        Recognizes hand gestures using Convexity Defects.
        Returns:
            gestures (list): List of detected gesture names (e.g., ["FIVE", "ONE"])
            landmarks (list): List of contours (for visualization, optional)
        """
        # 1. Preprocessing
        # ROI: We typically want to focus on the center or assume the hand is the largest skin object
        
        # Convert to HSV
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # 2. Skin Color Detection
        # Standard skin color range in HSV
        lower_skin = np.array([0, 20, 70], dtype=np.uint8)
        upper_skin = np.array([20, 255, 255], dtype=np.uint8)

        mask = cv2.inRange(hsv, lower_skin, upper_skin)

        # 3. Noise Removal (Morphology)
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.dilate(mask, kernel, iterations=4)
        mask = cv2.GaussianBlur(mask, (5, 5), 100)

        # 4. Find Contours
        contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            return [], []

        # Find largest contour (assumed to be hand)
        max_contour = max(contours, key=lambda x: cv2.contourArea(x))

        # Filter small noise
        if cv2.contourArea(max_contour) < 2000:
            return [], []

        # 5. Convex Hull and Defects
        try:
            hull = cv2.convexHull(max_contour)
            
            # Helper for defects: returnPoints=False to get indices
            hull_indices = cv2.convexHull(max_contour, returnPoints=False)
            defects = cv2.convexityDefects(max_contour, hull_indices)

            if defects is None:
                return [], [max_contour]

            count_fingers = 0

            # 6. Analyze Defects form fingers
            for i in range(defects.shape[0]):
                s, e, f, d = defects[i, 0]
                start = tuple(max_contour[s][0])
                end = tuple(max_contour[e][0])
                far = tuple(max_contour[f][0])

                # Calculate sides of triangle
                a = math.sqrt((end[0] - start[0])**2 + (end[1] - start[1])**2)
                b = math.sqrt((far[0] - start[0])**2 + (far[1] - start[1])**2)
                c = math.sqrt((end[0] - far[0])**2 + (end[1] - far[1])**2)

                # Cosine rule to find angle of the defect
                angle = math.acos((b**2 + c**2 - a**2) / (2*b*c)) * 57

                # If angle < 90, it's a finger gap
                if angle <= 90:
                    count_fingers += 1
                    # Draw defect (inter-finger point)
                    cv2.circle(frame, far, 5, [0, 0, 255], -1)

                # Draw hull
                cv2.line(frame, start, end, [0, 255, 255], 2)

            # The number of fingers is usually gaps + 1
            # But we handle 0 fingers (Fist) vs 1 finger vs 5 fingers
            total_fingers = count_fingers + 1
            
            gesture_name = "UNKNOWN"
            if total_fingers == 1:
                gesture_name = "ONE" # Pointing
            elif total_fingers == 2:
                gesture_name = "TWO"
            elif total_fingers >= 5:
                gesture_name = "FIVE" # Open Palm
            elif total_fingers == 0:
                gesture_name = "FIST"

            # Visual Feedback on Frame
            cv2.putText(frame, f"Fingers: {total_fingers}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
            cv2.putText(frame, f"Gesture: {gesture_name}", (50, 90), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.drawContours(frame, [max_contour], -1, (0, 255, 0), 2)
            
            return [gesture_name], [max_contour]

        except Exception as e:
            # print(f"Gesture Algo Error: {e}")
            return [], []

gesture_recognizer = GestureRecognizer()
