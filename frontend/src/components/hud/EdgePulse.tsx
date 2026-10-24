/**
 * EdgePulse — a brief full‑screen inset glow that flashes once each
 * time the HUD mode changes, reinforcing the screen transition.
 *
 * The overlay is purely decorative (`pointer-events: none`) and removes
 * itself from the DOM after the flash animation completes.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';

interface EdgePulseProps {
  mode: ProjectionHudMode;
  /** Glow colour for the session being entered; null disables the pulse. */
  accent: string | null;
}

export const EdgePulse: React.FC<EdgePulseProps> = ({ mode, accent }) => {
  // "Adjusting state during render" pattern — avoids setState-in-effect.
  const [tracked, setTracked] = useState({ mode, trigger: 0 });

  if (tracked.mode !== mode) {
    setTracked({ mode, trigger: tracked.trigger + 1 });
  }

  // Nothing to render until the first mode change.
  if (tracked.trigger === 0 || accent === null) return null;

  return (
    <motion.div
      key={tracked.trigger}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.55, 0] }}
      // Short delay so the glow lands on the incoming screen.
      transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut', times: [0, 0.25, 1] }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        boxShadow: `inset 0 0 80px 25px ${accent}`,
        borderRadius: 'inherit',
      }}
    />
  );
};
