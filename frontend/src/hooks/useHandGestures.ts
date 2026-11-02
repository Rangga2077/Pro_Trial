import { useWebSocket } from '../context/useWebSocket';

export type HandSide = 'Left' | 'Right';

/** MediaPipe names that don't read well after a plain underscore split. */
const GESTURE_NAMES: Record<string, string> = {
    ILOVEYOU: 'I Love You',
    UNKNOWN: 'Detected',
};

/** 'POINTING_UP' → 'Pointing Up'; 'UNKNOWN' (hand seen, no gesture) → 'Detected'. */
export function gestureLabel(gesture: string): string {
    return GESTURE_NAMES[gesture]
        ?? gesture.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Latest raw gesture per hand from `cv_update.data.hands`, or null when that
 * hand is not in view. For status display only; actions still come from
 * `cv_update.data.action`.
 */
export function useHandGestures(): Record<HandSide, string | null> {
    const { isConnected, lastMessage } = useWebSocket();
    // lastMessage survives a disconnect, so gate on the live connection.
    const hands = isConnected && lastMessage?.type === 'cv_update' ? lastMessage.data.hands ?? [] : [];
    const find = (side: HandSide) => hands.find(h => h.hand === side)?.gesture ?? null;
    return { Left: find('Left'), Right: find('Right') };
}
