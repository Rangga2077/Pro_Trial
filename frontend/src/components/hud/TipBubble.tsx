import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';

export interface TipBubbleColors {
    bg: string;
    border: string;
    shadow: string;
    heading: string;
    text: string;
    face: string;
}

export interface TipBubbleProps {
    /** Short uppercase line on top, e.g. "NEXT UP · GARLIC". A change shows at the next pop. */
    heading: string;
    /** Dialogue lines; the bubble pops out and back in with the next one. */
    lines: string[];
    colors: TipBubbleColors;
    /** How long each line stays up. */
    intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 5000;

/** Small chef face that "speaks" the bubble. */
function ChefFace({ color }: { color: string }) {
    return (
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            {/* Hat */}
            <path d="M10 13.5c-2.6-.4-4-2.4-3.6-4.6.4-2.3 2.7-3.6 4.8-3 .8-2.3 3.1-3.6 5.8-3.4 2.4.2 4.3 1.8 4.9 3.8 2.1-.8 4.5.3 5.1 2.6.6 2.4-.9 4.4-3 4.6v2.2H10v-2.2Z" fill="white" stroke="rgba(30,27,58,0.18)" strokeWidth="0.9" />
            {/* Face */}
            <circle cx="17" cy="22" r="9" fill={color} />
            {/* Eyes */}
            <circle cx="13.8" cy="21" r="1.25" fill="#1E1B3A" />
            <circle cx="20.2" cy="21" r="1.25" fill="#1E1B3A" />
            {/* Cheeks */}
            <circle cx="11.6" cy="24.2" r="1.5" fill="#FF8FA3" opacity="0.7" />
            <circle cx="22.4" cy="24.2" r="1.5" fill="#FF8FA3" opacity="0.7" />
            {/* Smile */}
            <path d="M14.6 24.6c1.3 1.4 3.5 1.4 4.8 0" stroke="#1E1B3A" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

/**
 * A small speech bubble that pops in and out, cycling through short lines.
 * Lives inside a panel's decorative zone (scan zone, stove zone), never as
 * a floating overlay. Reduced motion: lines cross-fade without the pop.
 */
export function TipBubble({ heading, lines, colors, intervalMs = DEFAULT_INTERVAL_MS }: TipBubbleProps) {
    const reduced = useReducedMotion() ?? false;
    // What the bubble shows. It only changes on its own timer, so a new step
    // or ticked item is picked up at the next pop instead of popping at once
    // (keeps the pop apart from the step / tick sounds).
    const [shown, setShown] = useState({ heading, lines, index: 0 });
    const latestRef = useRef({ heading, lines });
    useEffect(() => {
        latestRef.current = { heading, lines };
    });

    useEffect(() => {
        const timer = window.setInterval(() => {
            const latest = latestRef.current;
            setShown(prev => ({
                heading: latest.heading,
                lines: latest.lines,
                // A new context starts from its first line.
                index: latest.heading === prev.heading ? prev.index + 1 : 0,
            }));
        }, intervalMs);
        return () => window.clearInterval(timer);
    }, [intervalMs]);

    const line = shown.lines.length > 0 ? shown.lines[shown.index % shown.lines.length] : '';

    // One pop sound each time the bubble pops in (new line or new heading).
    // The ref stops StrictMode's double mount effect from popping twice.
    const bubbleKey = `${shown.heading}|${line}`;
    const poppedKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (poppedKeyRef.current === bubbleKey) return;
        poppedKeyRef.current = bubbleKey;
        playSfx('popup');
    }, [bubbleKey]);

    return (
        <AnimatePresence mode="wait" initial={!reduced}>
            <motion.div
                key={bubbleKey}
                role="status"
                aria-live="polite"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 10 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.75, y: -6 }}
                transition={reduced
                    ? { duration: 0.25 }
                    : { type: 'spring', stiffness: 460, damping: 22, mass: 0.7 }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    maxWidth: '100%',
                    padding: '8px 16px 8px 8px',
                    background: colors.bg,
                    border: `0.80px ${colors.border} solid`,
                    borderRadius: 999,
                    boxShadow: `0 6px 20px ${colors.shadow}`,
                    transformOrigin: 'bottom center',
                    boxSizing: 'border-box',
                    // Parents may centre their text (the session 3 header does).
                    textAlign: 'left',
                }}
            >
                <motion.div
                    animate={reduced ? undefined : { rotate: [0, -8, 6, 0] }}
                    transition={reduced ? undefined : { duration: 0.6, delay: 0.15, ease: 'easeInOut' }}
                    style={{ display: 'flex' }}
                >
                    <ChefFace color={colors.face} />
                </motion.div>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{
                        color: colors.heading,
                        fontSize: 9.6, fontFamily: 'Inter, sans-serif', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 1.2, lineHeight: '14px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{shown.heading}</span>
                    {line && (
                        <span style={{
                            color: colors.text,
                            fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 500,
                            lineHeight: '18px',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>{line}</span>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
