import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../context/useWebSocket';
import type { GestureAction, ServerWebSocketMessage, VoiceCommandMessage } from '../types/contracts';

/** How long without input before a screen counts as idle. */
export const IDLE_AFTER_MS = 6000;

/** Minimum gap between pointer-driven activity reports. */
const POINTER_THROTTLE_MS = 500;

export interface IdleActivity {
    /** No gesture, detection change or pointer input for the idle window, and nothing in view. */
    isIdle: boolean;
    /** YOLO reports at least one object in the latest frame. */
    isDetecting: boolean;
    /** Increments on every recognized gesture action; use it as an animation key. */
    gesturePulse: number;
    /** Most recent recognized gesture action, or null before the first one. */
    lastGesture: GestureAction | null;
    /** Report local input (pointer move, click) so the screen wakes up. */
    markActivity: () => void;
}

interface TrackedActivity {
    seenMessage: ServerWebSocketMessage | null;
    seenVoiceCommand: VoiceCommandMessage | null;
    wasDetecting: boolean;
    activityToken: number;
    gesturePulse: number;
    lastGesture: GestureAction | null;
    timedOut: boolean;
}

/**
 * Idle/activity tracking for ambient screen animation.
 *
 * Activity = a final gesture action from the backend interpreter, an object
 * entering or leaving the camera view, a recognized voice command, or local
 * pointer input. Raw gestures
 * are never interpreted here; only `cv_update.data.action` values are used.
 */
export function useIdleActivity(idleAfterMs = IDLE_AFTER_MS): IdleActivity {
    const { isConnected, lastMessage, lastVoiceCommand } = useWebSocket();
    const cvMessage = lastMessage?.type === 'cv_update' ? lastMessage : null;
    const action = cvMessage?.data.action ?? null;
    const isGesture = action !== null && action !== 'NO_ACTION';
    // lastMessage survives a disconnect, so gate on the live connection.
    const isDetecting = isConnected && (cvMessage?.data.objects.length ?? 0) > 0;

    const [tracked, setTracked] = useState<TrackedActivity>({
        // The message on screen at mount (e.g. the gesture that opened this
        // screen) is not new activity.
        seenMessage: cvMessage,
        seenVoiceCommand: lastVoiceCommand,
        wasDetecting: isDetecting,
        activityToken: 0,
        gesturePulse: 0,
        lastGesture: null,
        timedOut: false,
    });

    // "Adjusting state during render" pattern — avoids setState-in-effect.
    const isNewMessage = cvMessage !== null && cvMessage !== tracked.seenMessage;
    if (isNewMessage && (isGesture || isDetecting !== tracked.wasDetecting)) {
        setTracked(prev => ({
            ...prev,
            seenMessage: cvMessage,
            wasDetecting: isDetecting,
            activityToken: prev.activityToken + 1,
            gesturePulse: isGesture ? prev.gesturePulse + 1 : prev.gesturePulse,
            lastGesture: isGesture ? action : prev.lastGesture,
            timedOut: false,
        }));
    }

    // A recognized voice command also wakes the screen.
    if (lastVoiceCommand !== tracked.seenVoiceCommand) {
        setTracked(prev => ({
            ...prev,
            seenVoiceCommand: lastVoiceCommand,
            activityToken: prev.activityToken + 1,
            timedOut: false,
        }));
    }

    // Restart the idle countdown after every piece of activity.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setTracked(prev => ({ ...prev, timedOut: true }));
        }, idleAfterMs);
        return () => window.clearTimeout(timer);
    }, [tracked.activityToken, idleAfterMs]);

    const lastPointerAtRef = useRef(0);
    const markActivity = useCallback(() => {
        const now = performance.now();
        if (now - lastPointerAtRef.current < POINTER_THROTTLE_MS) return;
        lastPointerAtRef.current = now;
        setTracked(prev => ({ ...prev, activityToken: prev.activityToken + 1, timedOut: false }));
    }, []);

    return {
        isIdle: tracked.timedOut && !isDetecting,
        isDetecting,
        gesturePulse: tracked.gesturePulse,
        lastGesture: tracked.lastGesture,
        markActivity,
    };
}
