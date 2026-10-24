/**
 * Screen transition variants for ProjectionHud mode switches.
 *
 * The three sessions form a linear journey (Menu → Ingredient Check →
 * Cooking). Forward moves go "deeper", back moves mirror them. Screens
 * overlap during a switch (no blank frame), so each transition declares
 * which screen sits on top.
 *
 * Menu ↔ Ingredient Check also hands off a shared element (`layoutId`)
 * between the selected recipe card and the ingredient card. The screen
 * that *enters* with a shared element only fades — transforming its
 * parent would offset the layout animation.
 */

import type { TargetAndTransition, Variants } from 'framer-motion';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';

/* ── Transition keys ────────────────────────────────────────────────── */

export type TransitionKey =
  | 'menu>ingredient_check'
  | 'ingredient_check>cooking'
  | 'ingredient_check>menu'
  | 'cooking>menu'
  | 'fallback'
  | 'initial';

export interface ScreenTransitionCustom {
  key: TransitionKey;
  reduced: boolean;
}

/**
 * Resolve the transition for a mode switch. Returns `'initial'` on first
 * mount (no animation) and `'fallback'` for any unlisted pair.
 */
export function getTransitionKey(
  prev: ProjectionHudMode | null,
  current: ProjectionHudMode,
): TransitionKey {
  if (prev === null || prev === current) return 'initial';
  if (prev === 'menu' && current === 'ingredient_check') return 'menu>ingredient_check';
  if (prev === 'ingredient_check' && current === 'cooking') return 'ingredient_check>cooking';
  if (prev === 'ingredient_check' && current === 'menu') return 'ingredient_check>menu';
  if (prev === 'cooking' && current === 'menu') return 'cooking>menu';
  return 'fallback';
}

/* ── Shared element ids ─────────────────────────────────────────────── */

export const sharedLayoutIds = {
  surface: (recipeId: string) => `recipe-surface-${recipeId}`,
  title: (recipeId: string) => `recipe-title-${recipeId}`,
};

/* ── Timing ─────────────────────────────────────────────────────────── */

type Bezier = [number, number, number, number];

const EASE_OUT: Bezier = [0, 0, 0.2, 1];
const EASE_IN: Bezier = [0.4, 0, 1, 1];
const EASE_IN_OUT: Bezier = [0.65, 0, 0.35, 1];

const FORWARD_S = 0.42;
const WIPE_S = 0.5;
const BACK_S = 0.36;
const FADE_S = 0.25;
const REDUCED_S = 0.15;

/** Bottom edge collapsed → full screen; the reveal grows upward. */
const WIPE_HIDDEN = 'inset(100% 0% 0% 0%)';
const WIPE_SHOWN = 'inset(0% 0% 0% 0%)';

const NEUTRAL_ACCENT = 'rgba(255, 255, 255, 0.3)';

/* ── Transition table ───────────────────────────────────────────────── */

interface TransitionSpec {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  /** Stacking for the entering screen. */
  enterZ: number;
  /** Stacking for the leaving screen. */
  exitZ: number;
  /** EdgePulse colour, or null for no pulse. */
  accent: string | null;
}

const ENTER_ON_TOP = { enterZ: 2, exitZ: 1 };
const EXIT_ON_TOP = { enterZ: 1, exitZ: 2 };

const TRANSITIONS: Record<TransitionKey, TransitionSpec> = {
  'menu>ingredient_check': {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: FORWARD_S, ease: EASE_OUT } },
    exit: { opacity: 0, scale: 1.04, transition: { duration: FORWARD_S, ease: EASE_IN } },
    ...ENTER_ON_TOP,
    accent: 'rgba(2, 132, 199, 0.45)', // sky — ingredient check CTA
  },
  'ingredient_check>cooking': {
    initial: { clipPath: WIPE_HIDDEN },
    animate: { clipPath: WIPE_SHOWN, transition: { duration: WIPE_S, ease: EASE_IN_OUT } },
    exit: { opacity: 0.5, y: -40, transition: { duration: WIPE_S, ease: EASE_IN_OUT } },
    ...ENTER_ON_TOP,
    accent: 'rgba(5, 150, 105, 0.45)', // emerald — "all checked"
  },
  'ingredient_check>menu': {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: BACK_S, ease: EASE_OUT } },
    exit: { opacity: 0, x: '6%', transition: { duration: BACK_S, ease: EASE_IN } },
    ...EXIT_ON_TOP,
    accent: NEUTRAL_ACCENT,
  },
  'cooking>menu': {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: BACK_S, ease: EASE_OUT } },
    exit: { opacity: 0, scale: 0.94, transition: { duration: BACK_S, ease: EASE_IN } },
    ...EXIT_ON_TOP,
    accent: NEUTRAL_ACCENT,
  },
  fallback: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: FADE_S, ease: EASE_OUT } },
    exit: { opacity: 0, transition: { duration: FADE_S, ease: EASE_IN } },
    ...ENTER_ON_TOP,
    accent: NEUTRAL_ACCENT,
  },
  initial: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: FADE_S, ease: EASE_OUT } },
    exit: { opacity: 0, transition: { duration: FADE_S, ease: EASE_IN } },
    ...ENTER_ON_TOP,
    accent: null,
  },
};

const REDUCED: Pick<TransitionSpec, 'initial' | 'animate' | 'exit'> = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: REDUCED_S } },
  exit: { opacity: 0, transition: { duration: REDUCED_S } },
};

export function getTransitionAccent(key: TransitionKey): string | null {
  return TRANSITIONS[key].accent;
}

/* ── Variants ───────────────────────────────────────────────────────── */

/** Merge a target with an instant zIndex flip. */
function withZIndex(target: TargetAndTransition, zIndex: number): TargetAndTransition {
  return {
    ...target,
    zIndex,
    transition: { ...target.transition, zIndex: { duration: 0 } },
  };
}

function resolve(
  { key, reduced }: ScreenTransitionCustom,
  phase: 'initial' | 'animate' | 'exit',
): TargetAndTransition {
  const spec = TRANSITIONS[key];
  const target = reduced ? REDUCED[phase] : spec[phase];
  return withZIndex(target, phase === 'exit' ? spec.exitZ : spec.enterZ);
}

export const screenTransitionVariants: Variants = {
  initial: (custom: ScreenTransitionCustom) => resolve(custom, 'initial'),
  animate: (custom: ScreenTransitionCustom) => resolve(custom, 'animate'),
  exit: (custom: ScreenTransitionCustom) => resolve(custom, 'exit'),
};
