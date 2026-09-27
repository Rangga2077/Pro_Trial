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
}

export const EdgePulse: React.FC<EdgePulseProps> = ({ mode }) => {
  // "Adjusting state during render" pattern — avoids setState-in-effect.
  const [tracked, setTracked] = useState({ mode, trigger: 0 });

  if (tracked.mode !== mode) {
    setTracked({ mode, trigger: tracked.trigger + 1 });
  }

  // Nothing to render until the first mode change.
  if (tracked.trigger === 0) return null;

  return (
    <motion.div
      key={tracked.trigger}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.55, 0] }}
      transition={{ duration: 0.5, ease: 'easeOut', times: [0, 0.25, 1] }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        boxShadow: 'inset 0 0 80px 25px rgba(99, 102, 241, 0.35)',
        borderRadius: 'inherit',
      }}
    />
  );
};
