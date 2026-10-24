import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { playSfx, setJennyListening } from '../../audio/sfx';
import { useWebSocket } from '../../context/useWebSocket';
import type { JennyStatusMessage } from '../../types/contracts';

/** One camera-tracked ingredient of the current recipe. */
export interface CameraItem {
    name: string;
    checked: boolean;
    /** Confidence in the latest frame, when the item is in view. */
    liveConfidence?: number;
}

export interface JennyChatColors {
    panelBg: string;
    panelBorder: string;
    label: string;
    emptyText: string;
    chipBg: string;
    chipBorder: string;
    chipText: string;
    chipLive: string;
    chipLiveBorder: string;
    chipChecked: string;
    chipCheckedBg: string;
    chipCheckedBorder: string;
    questionText: string;
    replyBg: string;
    replyBorder: string;
    replyName: string;
    replyText: string;
}

export interface JennyChatPanelProps {
    /** Only the ingredients the camera can confirm; no chips when empty. */
    cameraItems: CameraItem[];
    colors: JennyChatColors;
}

const labelStyle = (color: string): React.CSSProperties => ({
    color,
    fontSize: 10.56,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    textTransform: 'uppercase',
    lineHeight: '15.84px',
    letterSpacing: 3.17,
});

/** Short status next to the panel label; the full note goes in the tooltip. */
function statusText(status: JennyStatusMessage['data']): string {
    switch (status.state) {
        case 'listening': return 'Listening…';
        case 'thinking': return 'Thinking…';
        case 'unavailable': return 'Offline';
        default: return status.message ?? 'Say “Hello Jenny”';
    }
}

/**
 * Session 2 side panel: chat history with Jenny (the local LLM), plus a chip
 * per camera-tracked ingredient. The user says "Hello Jenny", waits for the
 * pop, then asks; the backend records and transcribes the question and
 * reports progress as `jenny_status`. Replies come from WebSocketProvider's
 * llmHistory, which the cv_update stream can't overwrite.
 */
export function JennyChatPanel({ cameraItems, colors }: JennyChatPanelProps) {
    const { llmHistory, jennyStatus } = useWebSocket();
    const historyRef = useRef<HTMLDivElement>(null);
    const listening = jennyStatus.state === 'listening';
    const pendingQuestion = jennyStatus.state === 'thinking' ? jennyStatus.transcript ?? null : null;

    // Keep the newest reply (or the question being answered) in view.
    useEffect(() => {
        const el = historyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [llmHistory.length, pendingQuestion]);

    // Cue the user to speak, then keep music and effects out of the recording.
    useEffect(() => {
        if (!listening) return;
        playSfx('popup');
        setJennyListening(true);
        return () => setJennyListening(false);
    }, [listening]);

    return (
        <div style={{
            background: colors.panelBg,
            borderRadius: 24,
            border: `0.80px ${colors.panelBorder} solid`,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            // Same footprint as the old DETECTED ITEMS panel: shrinks first on short screens.
            flex: '0 1 202px', minHeight: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0, minWidth: 0 }}>
                <div style={{ ...labelStyle(colors.label), flexShrink: 0 }}>ASK JENNY</div>
                <div
                    role="status"
                    title={jennyStatus.message ?? undefined}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0,
                        color: listening ? colors.chipLive : colors.emptyText,
                        fontSize: 9.6, fontFamily: 'Inter, sans-serif', fontWeight: listening ? 700 : 500,
                        lineHeight: '15.84px', whiteSpace: 'nowrap',
                    }}
                >
                    {listening && (
                        <motion.span
                            aria-hidden
                            animate={{ opacity: [1, 0.25, 1] }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ width: 7, height: 7, borderRadius: 999, background: colors.chipLive, flexShrink: 0 }}
                        />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{statusText(jennyStatus)}</span>
                </div>
            </div>

            {/* Camera-tracked ingredients: one chip each, none if the recipe has none */}
            {cameraItems.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
                    {cameraItems.map(item => {
                        const live = item.liveConfidence !== undefined;
                        const status = item.checked ? '✓' : live ? `${Math.round(item.liveConfidence! * 100)}%` : '…';
                        return (
                            <div
                                key={item.name}
                                title={item.checked ? 'Checked' : live ? 'In view' : 'Scanning'}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '2px 10px', borderRadius: 999,
                                    background: item.checked ? colors.chipCheckedBg : colors.chipBg,
                                    border: `0.80px ${item.checked ? colors.chipCheckedBorder : live ? colors.chipLiveBorder : colors.chipBorder} solid`,
                                    transition: 'background 0.18s ease, border-color 0.18s ease',
                                }}
                            >
                                <span style={{
                                    color: colors.chipText, fontSize: 9.6, fontFamily: 'Inter, sans-serif',
                                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
                                    lineHeight: '16px', whiteSpace: 'nowrap',
                                }}>{item.name}</span>
                                <span style={{
                                    color: item.checked ? colors.chipChecked : live ? colors.chipLive : colors.emptyText,
                                    fontSize: 9.6, fontFamily: "'Cousine', 'Courier New', monospace", fontWeight: 700,
                                    lineHeight: '16px', whiteSpace: 'nowrap',
                                }}>{status}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Chat history — scrolls inside the panel */}
            <div
                ref={historyRef}
                style={{
                    flex: 1, minHeight: 0,
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${colors.panelBorder} transparent`,
                    display: 'flex', flexDirection: 'column', gap: 8,
                }}
            >
                {llmHistory.length === 0 && pendingQuestion === null ? (
                    <span style={{
                        color: colors.emptyText, fontSize: 10.4, fontFamily: 'Inter, sans-serif',
                        lineHeight: '15.6px',
                    }}>
                        Missing an ingredient? Say “Hello Jenny”, wait for the pop, then ask your question.
                    </span>
                ) : [
                    ...llmHistory,
                    ...(pendingQuestion !== null ? [{ query: pendingQuestion, response: null }] : []),
                ].map((entry, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{
                            alignSelf: 'flex-end', maxWidth: '90%',
                            color: colors.questionText, fontSize: 10.4, fontFamily: 'Inter, sans-serif',
                            lineHeight: '15.6px', textAlign: 'right',
                        }}>{entry.query}</span>
                        <div style={{
                            alignSelf: 'flex-start', maxWidth: '95%',
                            background: colors.replyBg,
                            border: `0.80px ${colors.replyBorder} solid`,
                            borderRadius: '4px 12px 12px 12px',
                            padding: '6px 10px',
                        }}>
                            <div style={{
                                color: colors.replyName, fontSize: 8.8, fontFamily: 'Inter, sans-serif',
                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, lineHeight: '13px',
                            }}>Jenny</div>
                            <div style={{
                                color: entry.response === null ? colors.emptyText : colors.replyText,
                                fontSize: 11.2, fontFamily: 'Inter, sans-serif',
                                lineHeight: '16.8px', whiteSpace: 'pre-wrap',
                                fontStyle: entry.response === null ? 'italic' : 'normal',
                            }}>{entry.response ?? 'Thinking…'}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
