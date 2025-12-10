import cv2
import numpy as np

class GestureRecognizer:
    def __init__(self):
        # MediaPipe is not supported on Python 3.13 yet.
        # Fallback to dummy or OpenCV-based implementation.
        print("GestureRecognizer: MediaPipe not available (Python 3.13). Using dummy.")

    def recognize(self, frame):
        # Dummy implementation
        gestures = []
        landmarks_list = []
        
        # TODO: Implement OpenCV-based fallback (skin color -> convex hull)
        
        return gestures, landmarks_list

gesture_recognizer = GestureRecognizer()
