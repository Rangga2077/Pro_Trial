/**
 * StoveZoneAmbient — the Cooking screen's stove target (concentric rings)
 * with decorative, input-reactive animation.
 *
 *  - idle:      heat waves roll outward, the rings breathe, embers drift up
 *  - detecting: the rings tighten and turn green (YOLO sees an object)
 *  - gesture:   one ripple from the centre per recognized gesture
 *
 * Purely visual (`pointer-events: none`). Render inside a positioned,
 * `overflow: hidden` container; layers centre themselves in it.
 */

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface StoveZoneAmbientProps {
    isIdle: boolean;
    isDetecting: boolean;
    /** Increments on each recognized gesture; every change plays one ripple. */
    gesturePulse: number;
    glowOuter: string;
    glowMiddle: string;
    emberColors: [string, string];
}

const RING_RGB = '107, 94, 184';
const DETECT_RGB = '16, 185, 129';

const OUTER = 224;
const INNER = 176;
const CORE = 126.4;

const BREATHE_S = 3.2;
const WAVE_S = 3.6;

/** Start delays (s) of the heat waves that roll out from the core. */
const WAVES = [0, 1.2, 2.4] as const;

/** Fixed ember layout (px from the zone centre) so renders stay deterministic. */
const EMBERS = [
    { dx: -34, dy: -18, size: 4, color: 0, duration: 3.4, delay: 0 },
    { dx: 20, dy: -34, size: 5, color: 1, duration: 4.1, delay: 0.8 },
    { dx: -6, dy: -46, size: 3, color: 0, duration: 3.8, delay: 1.6 },
    { dx: 42, dy: -10, size: 4, color: 0, duration: 4.4, delay: 2.2 },
    { dx: -48, dy: 8, size: 3, color: 1, duration: 3.6, delay: 2.9 },
    { dx: 6, dy: -22, size: 5, color: 1, duration: 4.0, delay: 3.5 },
] as const;

/** Absolutely positioned, centred in the zone. */
const centred = (size: number): React.CSSProperties => ({
    position: 'absolute',
    left: '50%', top: '50%',
    width: size, height: size,
    marginLeft: -size / 2, marginTop: -size / 2,
    borderRadius: '50%',
});

export const StoveZoneAmbient: React.FC<StoveZoneAmbientProps> = ({
    isIdle,
    isDetecting,
    gesturePulse,
    glowOuter,
    glowMiddle,
    emberColors,
}) => {
    const reduced = useReducedMotion() ?? false;
    const ambient = isIdle && !reduced;
    const rgb = isDetecting ? DETECT_RGB : RING_RGB;

    // Rings spring into place on state changes and breathe on a loop while idle.
    const ringTransition = (delay: number) => ({
        scale: ambient
            ? { duration: BREATHE_S, delay, repeat: Infinity, ease: 'easeInOut' as const }
            : { type: 'spring' as const, stiffness: 240, damping: 22 },
        default: { duration: 0.35 },
    });

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {/* Glow blobs */}
            <motion.div
                animate={{ opacity: ambient ? [0.65, 1, 0.65] : 1 }}
                transition={ambient ? { duration: BREATHE_S, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
                style={{ ...centred(340), background: glowOuter, filter: 'blur(60px)' }}
            />
            <div style={{ ...centred(284), background: glowMiddle, filter: 'blur(30px)' }} />

            {/* ── Lock-on glow (object in view) ── */}
            <AnimatePresence>
                {isDetecting && (
                    <motion.div
                        key="lock-glow"
                        initial={{ opacity: 0 }}
                        animate={reduced ? { opacity: 0.7 } : { opacity: [0.4, 0.9, 0.4] }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        transition={reduced ? { duration: 0.2 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ ...centred(OUTER), boxShadow: `0 0 70px 10px rgba(${DETECT_RGB}, 0.32)` }}
                    />
                )}
            </AnimatePresence>

            {/* ── Heat waves (idle) ── */}
            <AnimatePresence>
                {ambient && WAVES.map(delay => (
                    <motion.div
                        key={`wave-${delay}`}
                        initial={{ scale: 1, opacity: 0 }}
                        animate={{ scale: [1, 2.2], opacity: [0, 0.55, 0] }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        transition={{ duration: WAVE_S, delay, repeat: Infinity, ease: 'easeOut' }}
                        style={{ ...centred(CORE), border: `1.2px solid rgba(${RING_RGB}, 0.5)` }}
                    />
                ))}
            </AnimatePresence>

            {/* ── Rings ── */}
            <motion.div
                animate={{
                    scale: isDetecting ? 0.94 : ambient ? [1, 1.03, 1] : 1,
                    borderColor: `rgba(${rgb}, ${isDetecting ? 0.75 : 0.38})`,
                    boxShadow: `0px 0px 60px rgba(${rgb}, 0.28), inset 0px 0px 40px rgba(${rgb}, ${isDetecting ? 0.16 : 0.10})`,
                }}
                transition={ringTransition(0)}
                style={{ ...centred(OUTER), borderStyle: 'solid', borderWidth: 1.6 }}
            />
            <motion.div
                animate={{
                    scale: isDetecting ? 0.96 : ambient ? [1, 1.04, 1] : 1,
                    borderColor: `rgba(${rgb}, ${isDetecting ? 0.6 : 0.28})`,
                    boxShadow: `inset 0px 0px 30px rgba(${rgb}, 0.13)`,
                }}
                transition={ringTransition(0.4)}
                style={{ ...centred(INNER), borderStyle: 'solid', borderWidth: 0.8 }}
            />
            <motion.div
                animate={{
                    backgroundColor: `rgba(${rgb}, ${isDetecting ? 0.10 : 0.05})`,
                    borderColor: `rgba(${rgb}, ${isDetecting ? 0.7 : 0.35})`,
                }}
                transition={{ duration: 0.35 }}
                style={{
                    ...centred(CORE),
                    borderStyle: 'solid', borderWidth: 0.8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                <motion.span
                    animate={{
                        opacity: ambient ? [0.55, 1, 0.55] : 1,
                        color: isDetecting ? '#10B981' : `rgba(${RING_RGB}, 0.75)`,
                    }}
                    transition={{
                        opacity: ambient ? { duration: BREATHE_S, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 },
                        color: { duration: 0.35 },
                    }}
                    style={{
                        fontSize: 10,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        lineHeight: '15px',
                        letterSpacing: 3,
                        textTransform: 'uppercase',
                    }}
                >STOVE</motion.span>
            </motion.div>

            {/* ── Embers drifting up from the core (idle) ── */}
            <AnimatePresence>
                {ambient && EMBERS.map((ember, i) => (
                    <motion.div
                        key={`ember-${i}`}
                        initial={{ opacity: 0, y: 0 }}
                        animate={{ opacity: [0, 0.9, 0], y: [0, -40, -80] }}
                        exit={{ opacity: 0, transition: { duration: 0.3 } }}
                        transition={{ duration: ember.duration, delay: ember.delay, repeat: Infinity, ease: 'easeOut' }}
                        style={{
                            ...centred(ember.size),
                            left: `calc(50% + ${ember.dx}px)`,
                            top: `calc(50% + ${ember.dy}px)`,
                            background: emberColors[ember.color],
                        }}
                    />
                ))}
            </AnimatePresence>

            {/* ── Gesture ripple — remounts (and replays) per pulse ── */}
            {gesturePulse > 0 && !reduced && (
                <motion.div
                    key={gesturePulse}
                    initial={{ scale: 0.4, opacity: 0.6 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    style={{ ...centred(160), border: `2px solid rgba(${RING_RGB}, 0.7)` }}
                />
            )}
        </div>
    );
};
