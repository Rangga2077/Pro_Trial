/**
 * Screen transition variants for ProjectionHud mode switches.
 *
 * Each mode change (menu ↔ ingredient_check ↔ cooking) gets a distinct
 * enter/exit animation. The `custom` prop carries the TransitionDirection
 * so the same variant functions produce the right motion for every switch.
 *
 * Shape‑morph transition (Ingredient Check → Cooking) uses 8‑point CSS
 * clip‑path polygons that share the same vertex count so the browser can
 * smoothly interpolate between them.
 */

import type { Variants } from 'framer-motion';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';

/* ── Direction types ────────────────────────────────────────────────── */

export type TransitionDirection =
  | 'menu-to-ingredient'
  | 'ingredient-to-cooking'
  | 'to-menu'
  | 'initial';

/**
 * Determine the visual transition direction from a previous mode to
 * the current one.  Returns `'initial'` on first mount (no animation).
 */
export function getTransitionDirection(
  prev: ProjectionHudMode | null,
  current: ProjectionHudMode,
): TransitionDirection {
  if (prev === null || prev === current) return 'initial';
  if (current === 'menu') return 'to-menu';
  if (prev === 'menu' && current === 'ingredient_check') return 'menu-to-ingredient';
  if (prev === 'ingredient_check' && current === 'cooking') return 'ingredient-to-cooking';
  return 'to-menu'; // fallback — treat as "going back"
}

/* ── Shape‑morph clip‑paths ─────────────────────────────────────────
 * All polygons share exactly 8 vertices (midpoints added to rectangle
 * edges) so CSS can interpolate each coordinate pair smoothly.
 * ─────────────────────────────────────────────────────────────────── */

/** Full‑screen rectangle with midpoints on each edge. */
const RECT =
  'polygon(0% 0%, 50% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 0% 100%, 0% 50%)';

/** Diamond / rotated‑square — vertices pulled inward to 45° diagonals. */
const DIAMOND =
  'polygon(50% 2%, 76% 24%, 98% 50%, 76% 76%, 50% 98%, 24% 76%, 2% 50%, 24% 24%)';

/** Near‑center collapsed point — tiny shape that effectively disappears. */
const POINT =
  'polygon(50% 46%, 54% 48%, 54% 50%, 52% 54%, 50% 54%, 46% 52%, 46% 50%, 48% 46%)';

/* ── Timing constants ───────────────────────────────────────────────── */

const EXIT_S = 0.2;   // 200 ms
const ENTER_S = 0.2;  // 200 ms
const MORPH_S = 0.25; // slightly longer for shape morph legibility

const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];
const EASE_OUT: [number, number, number, number] = [0, 0, 0.2, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

/* ── Variants ───────────────────────────────────────────────────────── */

export const screenTransitionVariants: Variants = {
  /**
   * Initial state for the entering screen.  Determined by *how* we
   * arrived (the direction of the transition).
   */
  initial: (dir: TransitionDirection) => {
    switch (dir) {
      case 'menu-to-ingredient':
        return { opacity: 0, y: 60 };
      case 'ingredient-to-cooking':
        return { opacity: 0, clipPath: POINT };
      case 'to-menu':
        return { opacity: 0, scale: 0.95 };
      default:
        return { opacity: 0 };
    }
  },

  /**
   * Resting / visible state.  Shape‑morph uses keyframe arrays so the
   * clip‑path walks through intermediate shapes.
   */
  animate: (dir: TransitionDirection) => {
    switch (dir) {
      case 'menu-to-ingredient':
        return {
          opacity: 1,
          y: 0,
          transition: { duration: ENTER_S, ease: EASE_OUT },
        };
      case 'ingredient-to-cooking':
        return {
          opacity: [0, 1, 1],
          clipPath: [POINT, DIAMOND, RECT],
          transition: { duration: MORPH_S, ease: EASE_IN_OUT, times: [0, 0.45, 1] },
        };
      case 'to-menu':
        return {
          opacity: 1,
          scale: 1,
          transition: { duration: ENTER_S, ease: EASE_OUT },
        };
      default:
        return {
          opacity: 1,
          transition: { duration: ENTER_S, ease: EASE_OUT },
        };
    }
  },

  /**
   * Exit state for the leaving screen.
   */
  exit: (dir: TransitionDirection) => {
    switch (dir) {
      case 'menu-to-ingredient':
        return {
          opacity: 0,
          scale: 0.85,
          filter: 'blur(8px)',
          transition: { duration: EXIT_S, ease: EASE_IN },
        };
      case 'ingredient-to-cooking':
        return {
          opacity: [1, 0.7, 0],
          clipPath: [RECT, DIAMOND, POINT],
          transition: { duration: MORPH_S, ease: EASE_IN_OUT, times: [0, 0.55, 1] },
        };
      case 'to-menu':
        return {
          opacity: 0,
          y: 80,
          transition: { duration: EXIT_S, ease: EASE_IN },
        };
      default:
        return {
          opacity: 0,
          transition: { duration: EXIT_S * 0.75 },
        };
    }
  },
};
