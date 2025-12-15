import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';
import { RecipeStep } from './RecipeStep';

// Dummy recipe data
const RECIPE_STEPS = [
    "Chop the onions finely and place them in the glass bowl.",
    "Heat the olive oil in a large pan over medium heat.",
    "Add the minced garlic and sauté until fragrant.",
    "Pour in the tomato sauce and bring to a simmer.",
    "Season with salt, pepper, and dried oregano.",
    "Add the pasta to the boiling water and cook until al dente.",
    "Mix the pasta with the sauce and serve hot."
];

export const RecipeManager: React.FC = () => {
    const { lastMessage } = useWebSocket();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [lastGesture, setLastGesture] = useState<string | null>(null);

    // Debouncing checks
    const gestureCount = useRef<Record<string, number>>({});
    const lastActionTime = useRef<number>(0);
    const COOLDOWN_MS = 1700; // Reduced cooldown slightly
    const REQUIRED_FRAMES = 5; // Reduced from 10 to 5 for faster response

    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'cv_update') return;

        const gestures = lastMessage.data.gestures || [];
        if (gestures.length === 0) {
            // Reset counters if no gesture
            gestureCount.current = {};
            return;
        }

        const gesture = gestures[0]; // Take primary gesture

        // Increment counter for this gesture
        gestureCount.current[gesture] = (gestureCount.current[gesture] || 0) + 1;

        // Reset other gestures
        Object.keys(gestureCount.current).forEach(key => {
            if (key !== gesture) gestureCount.current[key] = 0;
        });

        const now = Date.now();
        if (now - lastActionTime.current < COOLDOWN_MS) return;

        // Check threshold
        if (gestureCount.current[gesture] > REQUIRED_FRAMES) {
            handleGestureAction(gesture);
            // Reset after action
            gestureCount.current[gesture] = 0;
            lastActionTime.current = now;
        }

        setLastGesture(gesture);

    }, [lastMessage]);

    const handleGestureAction = (gesture: string) => {
        if (gesture === 'FIVE') {
            // Next Step
            setCurrentStepIndex(prev =>
                prev < RECIPE_STEPS.length - 1 ? prev + 1 : prev
            );
            console.log("Action: NEXT STEP");
        } else if (gesture === 'ONE') {
            // Previous Step
            setCurrentStepIndex(prev =>
                prev > 0 ? prev - 1 : prev
            );
            console.log("Action: PREVIOUS STEP");
        }
    };

    return (
        <div className="relative w-full h-full">
            <RecipeStep
                stepNumber={currentStepIndex + 1}
                instruction={RECIPE_STEPS[currentStepIndex]}
            />

            {/* Debug / Feedback UI */}
            <div className="absolute bottom-10 right-10 bg-black/50 p-4 rounded-xl backdrop-blur-md border border-white/10">
                <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">Detected Gesture</p>
                <p className="text-2xl font-bold text-white">
                    {lastGesture || "NONE"}
                </p>
                <div className="mt-2 text-xs text-gray-500">
                    Map: FIVE (Open) &rarr; Next | ONE (Point) &rarr; Prev
                </div>
            </div>
        </div>
    );
};
