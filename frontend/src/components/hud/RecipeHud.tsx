import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import type { Recipe, GestureAction } from '../../types/contracts';
import svgPaths from '../svgTimerRings';

export interface RecipeHudProps {
    recipe: Recipe;
    stepNumber: number;
    totalSteps: number;
    instruction: string | null;
    progressPercent: number;
    onNextStep: () => void;
    onPreviousStep: () => void;
    onOpenMenu: () => void;
    isConnected: boolean;
    lastAction: GestureAction | null;
}

function formatClock(minutes: number | null | undefined, fallback: string): string {
    if (minutes == null) return fallback;
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TimerRingProps {
    index: number;
    label: string;
    value: string;
    progress: number;
    alert?: boolean;
}

function TimerRing({ index, label, value, progress, alert = false }: TimerRingProps) {
    const ringColor = alert ? '#FF3D5A' : '#6B5EB8';
    const indexColor = alert ? '#FF3D5A' : '#5B7CBC';
    const labelColor = alert ? '#FF8FAB' : '#5B7CBC';
    const totalLength = 427.26;
    const dash = (progress / 100) * totalLength;

    const ringContent = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Index label */}
            <div style={{
                color: indexColor,
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                lineHeight: '19.50px',
                marginBottom: 2,
                alignSelf: 'center',
            }}>({index})</div>

            {/* SVG Ring */}
            <div style={{ position: 'relative', width: 168, height: 168 }}>
                <svg
                    style={{ position: 'absolute', inset: 0 }}
                    width="168" height="168"
                    viewBox="0 0 168 168"
                    fill="none"
                >
                    {/* Outer dim ring */}
                    <path
                        d={svgPaths.p3ff9e000}
                        stroke={ringColor}
                        strokeOpacity={0.28}
                        strokeWidth="4"
                    />
                    {/* Middle glow ring */}
                    <path
                        d={svgPaths.p1cb6a770}
                        stroke={ringColor}
                        strokeOpacity={0.62}
                        strokeWidth="3"
                    />
                    {/* Progress arc */}
                    <motion.path
                        d={svgPaths.p2c33ce00}
                        stroke={ringColor}
                        strokeLinecap="round"
                        strokeWidth="9"
                        initial={{ strokeDasharray: `0 ${totalLength}` }}
                        animate={{ strokeDasharray: `${dash} ${totalLength}` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                </svg>

                {/* Center text */}
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 2,
                }}>
                    <div style={{
                        color: labelColor,
                        fontSize: 10,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        lineHeight: '12.50px',
                        letterSpacing: 1.50,
                        textAlign: 'center',
                        padding: '0 12px',
                    }}>{label}</div>
                    <div style={{
                        color: '#1E1B3A',
                        fontSize: 26,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        lineHeight: '26px',
                        letterSpacing: 1.30,
                    }}>{value}</div>
                </div>
            </div>
        </div>
    );

    if (alert) {
        return (
            <div style={{
                position: 'relative',
                background: 'rgba(255, 61, 90, 0.06)',
                borderRadius: 16,
                border: '0.80px rgba(255, 61, 90, 0.28) solid',
                boxShadow: '0px 0px 30px rgba(255, 61, 90, 0.12)',
                paddingTop: 8,
                paddingBottom: 8,
            }}>
                {ringContent}
            </div>
        );
    }

    return ringContent;
}

/* ─── Panel shared styles ─────────────────────────────────────────── */
const PANEL_BASE: React.CSSProperties = {
    position: 'relative',
    background: 'rgba(60, 55, 100, 0.04)',
    borderRadius: 24,
    overflow: 'hidden',
    flexShrink: 0,
};

const PANEL_OVERLAY: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(40, 38, 72, 0.08)',
    borderRadius: 24,
    border: '0.80px rgba(40, 38, 72, 0.10) solid',
    pointerEvents: 'none',
};

const SECTION_LABEL: React.CSSProperties = {
    color: 'rgba(107, 94, 184, 0.85)',
    fontSize: 12,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    lineHeight: '18px',
    letterSpacing: 3.60,
};

const DIVIDER: React.CSSProperties = {
    height: 1,
    background: 'rgba(40, 38, 72, 0.08)',
};

/* ─── Main component ─────────────────────────────────────────────── */
export const RecipeHud: React.FC<RecipeHudProps> = ({
    recipe,
    stepNumber,
    totalSteps,
    instruction,
    progressPercent,
    onNextStep,
    onPreviousStep,
    isConnected,
    lastAction,
}) => {
    const currentStep = recipe.instructions[stepNumber - 1];
    const timer1Value = formatClock(currentStep?.timer_minutes, '01:28');
    const timer2Value = formatClock(recipe.prep_time_minutes, '04:15');
    const timer1Label = recipe.title.toUpperCase().split(' ').slice(0, 2).join(' ');
    const timer2Label = (recipe.ingredients[1]?.name ?? 'PREP TIMER').toUpperCase();
    const timer1Progress = Math.min(95, 35 + (stepNumber - 1) * 12);
    const timer2Progress = 75;

    const gestureText = lastAction && lastAction !== 'NO_ACTION'
        ? `LAST GESTURE: ${lastAction.replace(/_/g, ' ')}`
        : 'LAST GESTURE: RIGHT INDEX / NEXT';

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: '#0A0F1A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            {/* ── Main card ─────────────────────────────────────────── */}
            <div style={{
                width: '100%',
                height: '100%',
                background: '#F5F4F0',
                borderRadius: 36,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0px 0px 60px rgba(107, 94, 184, 0.18)',
            }}>
                {/* Card border overlay */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 36,
                    border: '0.80px rgba(107, 94, 184, 0.20) solid',
                    pointerEvents: 'none',
                    zIndex: 10,
                }} />

                {/* ── Header ──────────────────────────────────────── */}
                <div style={{
                    paddingTop: 20,
                    paddingBottom: 12,
                    paddingLeft: 24,
                    paddingRight: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    flexShrink: 0,
                }}>
                    {/* Row 1: Status pills */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        {/* WEBSOCKET CONNECTED pill */}
                        <div style={{
                            background: 'rgba(245, 244, 240, 0.95)',
                            boxShadow: '0px 2px 12px rgba(100, 90, 170, 0.12)',
                            borderRadius: 10,
                            border: '0.80px rgba(107, 94, 184, 0.30) solid',
                            paddingTop: 8.80,
                            paddingBottom: 8.80,
                            paddingLeft: 12.80,
                            paddingRight: 12.80,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            <div style={{
                                width: 9,
                                height: 9,
                                background: isConnected ? '#6B5EB8' : '#FF3D5A',
                                borderRadius: '50%',
                            }} />
                            <span style={{
                                color: '#6B7080',
                                fontSize: 11,
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 700,
                                lineHeight: '16.50px',
                                letterSpacing: 1.10,
                            }}>
                                WEBSOCKET {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                            </span>
                        </div>

                        {/* LAST GESTURE pill */}
                        <div style={{
                            background: 'rgba(245, 244, 240, 0.95)',
                            boxShadow: '0px 2px 12px rgba(100, 90, 170, 0.12)',
                            borderRadius: 10,
                            border: '0.80px rgba(255, 61, 90, 0.34) solid',
                            paddingTop: 12.55,
                            paddingBottom: 12.55,
                            paddingLeft: 12.80,
                            paddingRight: 12.80,
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: 41.60,
                            boxSizing: 'border-box',
                        }}>
                            <span style={{
                                color: '#6B7080',
                                fontSize: 11,
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 700,
                                lineHeight: '16.50px',
                                letterSpacing: 1.10,
                            }}>{gestureText}</span>
                        </div>
                    </div>

                    {/* Row 2: Progress bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}>
                        <span style={SECTION_LABEL}>PROGRESS</span>

                        <div style={{
                            flex: 1,
                            height: 8,
                            minWidth: 1,
                            background: 'rgba(60, 55, 100, 0.07)',
                            borderRadius: 999,
                            overflow: 'hidden',
                        }}>
                            <motion.div
                                style={{
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #6B5EB8 0%, #7265BC 14%, #7F73C4 43%, #9085CE 79%, #9B8FD4 100%)',
                                    borderRadius: 999,
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>

                        <span style={{
                            color: 'rgba(107, 94, 184, 0.85)',
                            fontSize: 12,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 400,
                            lineHeight: '18px',
                            whiteSpace: 'nowrap',
                        }}>{stepNumber}/{totalSteps}</span>
                    </div>
                </div>

                {/* ── 3-column content ────────────────────────────── */}
                <div style={{
                    flex: 1,
                    minHeight: 0,
                    paddingBottom: 20,
                    paddingLeft: 24,
                    paddingRight: 24,
                    display: 'flex',
                    gap: 16,
                    alignItems: 'stretch',
                }}>

                    {/* ──── LEFT: TIMERS ──────────────────────────── */}
                    <div style={{ ...PANEL_BASE, width: 220 }}>
                        <div style={{
                            padding: 16.80,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            height: '100%',
                            boxSizing: 'border-box',
                        }}>
                            <div style={SECTION_LABEL}>TIMERS</div>

                            <TimerRing
                                index={1}
                                label={timer1Label}
                                value={timer1Value}
                                progress={timer1Progress}
                            />

                            <TimerRing
                                index={2}
                                label={timer2Label}
                                value={timer2Value}
                                progress={timer2Progress}
                                alert
                            />
                        </div>
                        <div style={PANEL_OVERLAY} />
                    </div>

                    {/* ──── CENTER: RECIPE ────────────────────────── */}
                    <div style={{
                        ...PANEL_BASE,
                        flex: 1,
                        minWidth: 0,
                        flexShrink: 1,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        {/* Recipe header text */}
                        <div style={{
                            paddingTop: 24,
                            paddingLeft: 24,
                            paddingRight: 24,
                            paddingBottom: 16,
                            textAlign: 'center',
                            flexShrink: 0,
                        }}>
                            <div style={{ ...SECTION_LABEL, display: 'block', marginBottom: 4 }}>
                                RECIPE
                            </div>
                            <div style={{
                                color: '#1E1B3A',
                                fontSize: 22,
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 500,
                                lineHeight: '26.40px',
                                letterSpacing: 0.60,
                                marginBottom: 6,
                            }}>
                                {recipe.title.toUpperCase()}
                            </div>
                            <div style={{ ...SECTION_LABEL, display: 'block', marginBottom: 4 }}>
                                STEP {stepNumber}
                            </div>
                            <div style={{
                                color: 'rgba(30, 27, 58, 0.65)',
                                fontSize: 15,
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 400,
                                lineHeight: '22.50px',
                            }}>
                                {instruction ?? 'Follow the recipe step carefully.'}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={DIVIDER} />

                        {/* Stove concentric circles */}
                        <div style={{
                            flex: 1,
                            minHeight: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Outer glow blob */}
                            <div style={{
                                position: 'absolute',
                                width: 340,
                                height: 340,
                                background: 'rgba(107, 94, 184, 0.06)',
                                borderRadius: '50%',
                                filter: 'blur(60px)',
                            }} />
                            {/* Middle glow blob */}
                            <div style={{
                                position: 'absolute',
                                width: 284,
                                height: 284,
                                background: 'rgba(107, 94, 184, 0.10)',
                                borderRadius: '50%',
                                filter: 'blur(30px)',
                            }} />
                            {/* Outer ring */}
                            <div style={{
                                position: 'absolute',
                                width: 224,
                                height: 224,
                                borderRadius: '50%',
                                border: '1.60px rgba(107, 94, 184, 0.38) solid',
                                boxShadow: '0px 0px 60px rgba(107, 94, 184, 0.28), inset 0px 0px 40px rgba(107, 94, 184, 0.10)',
                            }} />
                            {/* Inner ring */}
                            <div style={{
                                position: 'absolute',
                                width: 176,
                                height: 176,
                                borderRadius: '50%',
                                border: '0.80px rgba(107, 94, 184, 0.28) solid',
                                boxShadow: 'inset 0px 0px 30px rgba(107, 94, 184, 0.13)',
                            }} />
                            {/* Core circle with STOVE label */}
                            <div style={{
                                position: 'absolute',
                                width: 126.40,
                                height: 126.40,
                                borderRadius: '50%',
                                background: 'rgba(107, 94, 184, 0.05)',
                                border: '0.80px rgba(107, 94, 184, 0.35) solid',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <span style={{
                                    color: 'rgba(107, 94, 184, 0.75)',
                                    fontSize: 10,
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 500,
                                    lineHeight: '15px',
                                    letterSpacing: 3,
                                    textTransform: 'uppercase',
                                }}>STOVE</span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={DIVIDER} />

                        {/* Footer navigation */}
                        <div style={{
                            paddingTop: 16,
                            paddingBottom: 16,
                            paddingLeft: 24,
                            paddingRight: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0,
                        }}>
                            {/* BACK button */}
                            <button
                                onClick={onPreviousStep}
                                disabled={stepNumber === 1}
                                style={{
                                    background: 'rgba(40, 38, 72, 0.08)',
                                    borderRadius: 999,
                                    border: '0.80px rgba(40, 38, 72, 0.10) solid',
                                    paddingTop: 10,
                                    paddingBottom: 10,
                                    paddingLeft: 16,
                                    paddingRight: 20,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    cursor: stepNumber === 1 ? 'not-allowed' : 'pointer',
                                    opacity: stepNumber === 1 ? 0.45 : 1,
                                    transition: 'opacity 0.2s',
                                }}
                            >
                                <ChevronLeft
                                    size={16}
                                    color="rgba(107, 94, 184, 0.70)"
                                    strokeWidth={1.8}
                                />
                                <span style={{
                                    color: 'rgba(30, 27, 58, 0.65)',
                                    fontSize: 14,
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 500,
                                    lineHeight: '21px',
                                }}>BACK</span>
                            </button>

                            {/* NEXT button */}
                            <button
                                onClick={onNextStep}
                                disabled={stepNumber === totalSteps}
                                style={{
                                    background: '#6B5EB8',
                                    borderRadius: 999,
                                    border: 'none',
                                    paddingTop: 8,
                                    paddingBottom: 8,
                                    paddingLeft: 28,
                                    paddingRight: 28,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    cursor: stepNumber === totalSteps ? 'not-allowed' : 'pointer',
                                    opacity: stepNumber === totalSteps ? 0.45 : 1,
                                    transition: 'opacity 0.2s',
                                }}
                            >
                                <span style={{
                                    color: '#F5F4F0',
                                    fontSize: 14,
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 500,
                                    lineHeight: '21px',
                                    letterSpacing: 0.70,
                                }}>NEXT</span>
                            </button>
                        </div>

                        <div style={PANEL_OVERLAY} />
                    </div>

                    {/* ──── RIGHT: UTILITY ────────────────────────── */}
                    <div style={{ ...PANEL_BASE, width: 220 }}>
                        <div style={{
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            height: '100%',
                            boxSizing: 'border-box',
                        }}>
                            {/* INGREDIENTS */}
                            <div>
                                <div style={{ ...SECTION_LABEL, marginBottom: 14 }}>
                                    INGREDIENTS
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 8,
                                }}>
                                    {Array.from({ length: 9 }).map((_, i) => (
                                        <div key={i} style={{
                                            aspectRatio: '1',
                                            background: 'rgba(40, 38, 72, 0.08)',
                                            borderRadius: 14,
                                            border: '0.80px rgba(40, 38, 72, 0.10) solid',
                                        }} />
                                    ))}
                                </div>
                            </div>

                            {/* UTENSILS */}
                            <div>
                                <div style={{ ...SECTION_LABEL, marginBottom: 8 }}>
                                    UTENSILS
                                </div>
                                <div style={DIVIDER} />
                                {['Skillet', 'Spatula', 'Timer'].map((tool) => (
                                    <div key={tool} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        paddingTop: 2,
                                        paddingBottom: 2,
                                        marginTop: 8,
                                    }}>
                                        <div style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: 'rgba(107, 94, 184, 0.55)',
                                            flexShrink: 0,
                                        }} />
                                        <span style={{
                                            color: '#6B7080',
                                            fontSize: 11,
                                            fontFamily: 'Inter, sans-serif',
                                            fontWeight: 400,
                                            lineHeight: '16.50px',
                                        }}>{tool}</span>
                                    </div>
                                ))}
                            </div>

                            {/* STOVE STATUS */}
                            <div>
                                <div style={{ ...SECTION_LABEL, marginBottom: 8 }}>
                                    STOVE STATUS
                                </div>
                                <div style={DIVIDER} />
                                <div style={{
                                    color: '#6B5EB8',
                                    fontSize: 26,
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 700,
                                    lineHeight: '26px',
                                    marginTop: 7,
                                    marginBottom: 13,
                                }}>ACTIVE</div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 5,
                                }}>
                                    <span style={{
                                        color: '#1E1B3A',
                                        fontSize: 11,
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 400,
                                        lineHeight: '16.50px',
                                    }}>Left Hand:</span>
                                    <span style={{
                                        color: '#FF5A6A',
                                        fontSize: 11,
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 700,
                                        lineHeight: '16.50px',
                                    }}>Detected</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{
                                        color: '#1E1B3A',
                                        fontSize: 11,
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 400,
                                        lineHeight: '16.50px',
                                    }}>Right Hand:</span>
                                    <span style={{
                                        color: '#6B7080',
                                        fontSize: 11,
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 400,
                                        lineHeight: '16.50px',
                                    }}>Miss</span>
                                </div>
                            </div>

                            {/* Notes box */}
                            <div style={{
                                background: 'rgba(40, 38, 72, 0.08)',
                                borderRadius: 14,
                                border: '0.80px rgba(40, 38, 72, 0.10) solid',
                                padding: '12.80px',
                                marginTop: 'auto',
                            }}>
                                <span style={{
                                    color: 'rgba(30, 27, 58, 0.45)',
                                    fontSize: 12,
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 400,
                                    lineHeight: '19.50px',
                                }}>Notes / details placeholder</span>
                            </div>
                        </div>
                        <div style={PANEL_OVERLAY} />
                    </div>
                </div>
            </div>
        </div>
    );
};
