/**
 * VoiceStatusIndicator — mic pill for the HUD headers.
 *
 * Shows whether the backend's offline recognizer is listening, and the last
 * phrase it turned into a command (flashes once per new command).
 */

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import type { VoiceCommandMessage, VoiceState } from '../../types/contracts';

export interface VoiceIndicatorColors {
    bg: string;
    border: string;
    text: string;
    /** Mic, bars and flash colour while listening. */
    accent: string;
}

export interface VoiceStatusIndicatorProps {
    state: VoiceState;
    command: VoiceCommandMessage | null;
    colors: VoiceIndicatorColors;
    height: number;
}

const ERROR_COLOR = '#FF5A6A';
const BAR_HEIGHTS = [5, 9, 6] as const;

export const VoiceStatusIndicator: React.FC<VoiceStatusIndicatorProps> = ({ state, command, colors, height }) => {
    const reduced = useReducedMotion() ?? false;
    const listening = state === 'listening';

    // Count commands so each new one replays the flash ("adjusting state during render").
    const [seen, setSeen] = useState({ command, count: 0 });
    if (seen.command !== command) {
        setSeen({ command, count: seen.count + 1 });
    }

    const label = listening ? 'LISTENING' : state === 'error' ? 'MIC ERROR' : 'VOICE OFF';
    const iconColor = state === 'error' ? ERROR_COLOR : listening ? colors.accent : colors.text;
    const transcript = listening && command ? command.data.transcript : null;

    return (
        <div
            title={state === 'error' ? 'Voice commands unavailable — check the microphone and VOICE_MODEL_PATH' : undefined}
            style={{
                height, boxSizing: 'border-box',
                paddingLeft: 12, paddingRight: 12,
                background: colors.bg, borderRadius: 10,
                border: `0.80px ${state === 'error' ? ERROR_COLOR : colors.border} solid`,
                display: 'flex', alignItems: 'center', gap: 8,
                flexShrink: 0, maxWidth: 260,
                position: 'relative', isolation: 'isolate', overflow: 'hidden',
                opacity: state === 'disabled' ? 0.6 : 1,
            }}
        >
            {seen.count > 0 && command && (
                <motion.div
                    key={seen.count}
                    initial={{ opacity: 0.35 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    style={{ position: 'absolute', inset: 0, zIndex: -1, background: colors.accent }}
                />
            )}

            {listening
                ? <Mic size={13} color={iconColor} strokeWidth={2} style={{ flexShrink: 0 }} />
                : <MicOff size={13} color={iconColor} strokeWidth={2} style={{ flexShrink: 0 }} />}

            {listening && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 10 }}>
                    {BAR_HEIGHTS.map((barHeight, i) => (
                        <motion.div
                            key={i}
                            animate={reduced ? { scaleY: 1 } : { scaleY: [0.5, 1, 0.5] }}
                            transition={reduced ? { duration: 0 } : { duration: 1.1, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ width: 2, height: barHeight, borderRadius: 1, background: colors.accent }}
                        />
                    ))}
                </div>
            )}

            <span style={{
                color: colors.text, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 700,
                lineHeight: '16.50px', letterSpacing: 1.1, whiteSpace: 'nowrap',
            }}>{label}</span>

            {transcript && (
                <span style={{
                    color: colors.accent, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600,
                    lineHeight: '16.50px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                }}>“{transcript}”</span>
            )}
        </div>
    );
};
