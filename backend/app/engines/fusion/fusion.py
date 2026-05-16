class FusionEngine:
    def __init__(self):
        self.last_action = None
        self.consecutive_frames = 0
        self.THRESHOLD = 3

    def fuse(self, objects, gestures):
        """
        Combines object detection and gesture recognition to determine intent.
        Returns an Action string or None.
        """
        primary_gesture = gestures[0] if gestures else None
        
        if not primary_gesture:
            self.consecutive_frames = 0
            return None

        # Example Rule: Pointing at something
        if primary_gesture == "POINTING":
            # Check if pointing at an object (simplified logic: just checks existence)
            # In real implementation, this would check intersection of pointer ray and object bbox
            if objects:
                 # Just take the first object for now
                target_obj = objects[0]['label']
                intent = f"SELECT_{target_obj.upper()}"
            else:
                intent = "PREVIOUS_STEP" # Fallback navigation
        
        elif primary_gesture == "OPEN_PALM":
            intent = "NEXT_STEP"
        
        elif primary_gesture == "CLOSED_FIST":
            intent = "STOP_TIMER"
        
        else:
            intent = None

        # Simple temporal smoothing
        if intent == self.last_action:
            self.consecutive_frames += 1
        else:
            self.consecutive_frames = 0
            self.last_action = intent

        if self.consecutive_frames >= self.THRESHOLD:
            # fire action once
            if self.consecutive_frames == self.THRESHOLD:
                return intent
            
        return None

fusion_engine = FusionEngine()
