import { useMemo, useState } from 'react';
import { useWebSocket } from '../context/useWebSocket';
import type { Ingredient, ServerWebSocketMessage } from '../types/contracts';

/**
 * Detector class label → the recipe ingredient names it confirms (exact,
 * case-insensitive, so "Egg Noodles" never counts as an egg). Only classes
 * the trained model knows belong here; append as more classes are trained.
 */
export const DETECTOR_INGREDIENTS: Record<string, string[]> = {
    chicken_egg: ['eggs', 'egg'],
    soy_sauce: ['soy sauce', 'dark soy sauce'],
};

/** Detections below this confidence are ignored. */
const MIN_CONFIDENCE = 0.5;

/** Consecutive camera frames an item must stay in view before it counts. */
const CONFIRM_FRAMES = 6;

export interface IngredientDetections {
    /** Recipe ingredient indexes the camera can confirm. */
    trackedIndexes: number[];
    /** Tracked ingredients that have been held in view steadily at least once. */
    confirmed: ReadonlySet<number>;
    /** Best confidence per tracked ingredient in the latest frame. */
    liveConfidence: ReadonlyMap<number, number>;
}

interface TrackedFrames {
    seenMessage: ServerWebSocketMessage | null;
    streaks: Record<string, number>;
    confirmedLabels: string[];
}

function labelFor(ingredient: Ingredient): string | null {
    const name = ingredient.name.trim().toLowerCase();
    for (const [label, names] of Object.entries(DETECTOR_INGREDIENTS)) {
        if (names.includes(name)) return label;
    }
    return null;
}

/**
 * Maps YOLO detections from `cv_update.data.objects` onto a recipe's
 * ingredients. Only the objects list is used, never raw gestures.
 */
export function useIngredientDetections(ingredients: Ingredient[]): IngredientDetections {
    const { isConnected, lastMessage } = useWebSocket();
    // lastMessage survives a disconnect, so gate on the live connection.
    const cvMessage = isConnected && lastMessage?.type === 'cv_update' ? lastMessage : null;

    const labels = useMemo(() => ingredients.map(labelFor), [ingredients]);

    // Best confidence per known label in the latest frame.
    const present = new Map<string, number>();
    for (const object of cvMessage?.data.objects ?? []) {
        if (!(object.label in DETECTOR_INGREDIENTS) || object.confidence < MIN_CONFIDENCE) continue;
        present.set(object.label, Math.max(present.get(object.label) ?? 0, object.confidence));
    }

    const [tracked, setTracked] = useState<TrackedFrames>({ seenMessage: null, streaks: {}, confirmedLabels: [] });

    // "Adjusting state during render" pattern. State only changes while a
    // streak is building or breaking, not on every 30 ms frame.
    if (cvMessage !== null && cvMessage !== tracked.seenMessage) {
        const streaks: Record<string, number> = {};
        let changed = false;
        for (const label of Object.keys(DETECTOR_INGREDIENTS)) {
            const previous = tracked.streaks[label] ?? 0;
            const next = present.has(label) ? Math.min(previous + 1, CONFIRM_FRAMES) : 0;
            streaks[label] = next;
            if (next !== previous) changed = true;
        }
        if (changed) {
            const newlyConfirmed = Object.keys(streaks)
                .filter(label => streaks[label] === CONFIRM_FRAMES && !tracked.confirmedLabels.includes(label));
            setTracked({
                seenMessage: cvMessage,
                streaks,
                confirmedLabels: [...tracked.confirmedLabels, ...newlyConfirmed],
            });
        }
    }

    const trackedIndexes: number[] = [];
    const confirmed = new Set<number>();
    const liveConfidence = new Map<number, number>();
    labels.forEach((label, index) => {
        if (label === null) return;
        trackedIndexes.push(index);
        if (tracked.confirmedLabels.includes(label)) confirmed.add(index);
        const confidence = present.get(label);
        if (confidence !== undefined) liveConfidence.set(index, confidence);
    });

    return { trackedIndexes, confirmed, liveConfidence };
}
