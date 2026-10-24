/**
 * ScanZoneAmbient — decorative, input-reactive layers for the Ingredient
 * Check detection zone.
 *
 *  - idle:      scan beam sweeps down, corner brackets breathe, particles drift up
 *  - detecting: brackets lock inward and the zone glows (YOLO sees an object)
 *  - gesture:   one ripple from the zone centre per recognized gesture
 *
 * Purely visual (`pointer-events: none`). Render inside a positioned,
 * `overflow: hidden` container.
 */

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface ScanZoneAmbientProps {
    isIdle: boolean;
    isDetecting: boolean;
    /** Increments on each recognized gesture; every change plays one ripple. */
    gesturePulse: number;
    bracketColor: string;
    /** "r, g, b" triplet used for the beam and ripple. */
    beamRgb: string;
    particleColors: [string, string];
}

const DETECT_COLOR = '#10B981';
const DETECT_RGB = '16, 185, 129';

/** px the brackets travel inward when an object is in view. */
const LOCK_INSET = 22;
/** px the brackets drift inward while breathing. */
const BREATHE_INSET = 4;

const BREATHE_S = 2.4;
const BEAM_S = 3.2;

const CORNERS = [
    { key: 'tl', h: 'left', v: 'top' },
    { key: 'tr', h: 'right', v: 'top' },
    { key: 'bl', h: 'left', v: 'bottom' },
    { key: 'br', h: 'right', v: 'bottom' },
] as const;

/** Fixed layout (% of the zone) so renders stay deterministic. */
const PARTICLES = [
    { left: 12, top: 78, size: 5, color: 0, duration: 5.2, delay: 0 },
    { left: 26, top: 64, size: 4, color: 1, duration: 6.4, delay: 1.1 },
    { left: 41, top: 86, size: 6, color: 0, duration: 4.8, delay: 2.3 },
    { left: 57, top: 72, size: 4, color: 1, duration: 5.9, delay: 0.6 },
    { left: 69, top: 90, size: 5, color: 0, duration: 6.8, delay: 1.8 },
    { left: 82, top: 68, size: 6, color: 1, duration: 5.4, delay: 2.9 },
    { left: 92, top: 82, size: 4, color: 0, duration: 4.6, delay: 3.4 },
] as const;

export const ScanZoneAmbient: React.FC<ScanZoneAmbientProps> = ({
    isIdle,
    isDetecting,
    gesturePulse,
    bracketColor,
    beamRgb,
    particleColors,
}) => {
    const reduced = useReducedMotion() ?? false;
    const ambient = isIdle && !reduced;

    return (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none' }}>
            {/* ── Scan beam (idle) ── */}
            <AnimatePresence>
                {ambient && (
                    <motion.div
                        key="beam"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        style={{ position: 'absolute', inset: 0 }}
                    >
                        {/* Layer is zone-sized; its bottom edge carries the beam line. */}
                        <motion.div
                            animate={{ y: ['-105%', '40%'] }}
                            transition={{ duration: BEAM_S, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
                            style={{ position: 'absolute', inset: 0 }}
                        >
                            <div style={{
                                position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%',
                                background: `linear-gradient(to bottom, rgba(${beamRgb}, 0) 0%, rgba(${beamRgb}, 0.10) 75%, rgba(${beamRgb}, 0.26) 100%)`,
                            }} />
                            <div style={{
                                position: 'absolute', left: '6%', right: '6%', bottom: 0, height: 2,
                                borderRadius: 1,
                                background: `rgba(${beamRgb}, 0.75)`,
                                boxShadow: `0 0 12px rgba(${beamRgb}, 0.6)`,
                            }} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Drifting particles (idle) ── */}
            <AnimatePresence>
                {ambient && PARTICLES.map((p, i) => (
                    <motion.div
                        key={`particle-${i}`}
                        initial={{ opacity: 0, y: 0 }}
                        animate={{ opacity: [0, 0.85, 0], y: [0, -28, -56] }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
                        style={{
                            position: 'absolute',
                            left: `${p.left}%`, top: `${p.top}%`,
                            width: p.size, height: p.size,
                            borderRadius: '50%',
                            background: particleColors[p.color],
                        }}
                    />
                ))}
            </AnimatePresence>

            {/* ── Lock-on glow (object in view) ── */}
            <AnimatePresence>
                {isDetecting && (
                    <motion.div
                        key="lock-glow"
                        initial={{ opacity: 0 }}
                        animate={reduced ? { opacity: 0.6 } : { opacity: [0.35, 0.8, 0.35] }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        transition={reduced ? { duration: 0.2 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute', inset: 0,
                            borderRadius: 'inherit',
                            boxShadow: `inset 0 0 48px rgba(${DETECT_RGB}, 0.35)`,
                        }}
                    />
                )}
            </AnimatePresence>

            {/* ── Gesture ripple — remounts (and replays) per pulse ── */}
            {gesturePulse > 0 && !reduced && (
                <motion.div
                    key={gesturePulse}
                    initial={{ scale: 0.2, opacity: 0.55 }}
                    animate={{ scale: 2.6, opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    style={{
                        position: 'absolute',
                        left: '50%', top: '50%',
                        width: 160, height: 160,
                        marginLeft: -80, marginTop: -80,
                        borderRadius: '50%',
                        border: `2px solid rgba(${beamRgb}, 0.7)`,
                    }}
                />
            )}

            {/* ── Corner brackets ── */}
            {CORNERS.map(corner => {
                // Unit vector pointing from this corner toward the zone centre.
                const ix = corner.h === 'left' ? 1 : -1;
                const iy = corner.v === 'top' ? 1 : -1;

                const animate = isDetecting
                    ? { x: ix * LOCK_INSET, y: iy * LOCK_INSET, opacity: 1, borderColor: DETECT_COLOR }
                    : ambient
                        ? {
                            x: [0, ix * BREATHE_INSET, 0],
                            y: [0, iy * BREATHE_INSET, 0],
                            opacity: [0.6, 1, 0.6],
                            borderColor: bracketColor,
                        }
                        : { x: 0, y: 0, opacity: 1, borderColor: bracketColor };

                const transition = !isDetecting && ambient
                    ? { duration: BREATHE_S, repeat: Infinity, ease: 'easeInOut' as const }
                    : { type: 'spring' as const, stiffness: 260, damping: 22 };

                return (
                    <motion.div
                        key={corner.key}
                        animate={animate}
                        transition={transition}
                        style={{
                            position: 'absolute',
                            left: corner.h === 'left' ? 1.6 : undefined,
                            right: corner.h === 'right' ? 1.6 : undefined,
                            top: corner.v === 'top' ? 1.6 : undefined,
                            bottom: corner.v === 'bottom' ? 1.6 : undefined,
                            width: 24, height: 24,
                            borderRadius: 3,
                            borderStyle: 'solid',
                            borderColor: bracketColor,
                            borderTopWidth: corner.v === 'top' ? 1.6 : 0,
                            borderBottomWidth: corner.v === 'bottom' ? 1.6 : 0,
                            borderLeftWidth: corner.h === 'left' ? 1.6 : 0,
                            borderRightWidth: corner.h === 'right' ? 1.6 : 0,
                        }}
                    />
                );
            })}
        </div>
    );
};
