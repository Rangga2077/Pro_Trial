import { motion } from 'framer-motion';
import { ChevronLeft, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Recipe, GestureAction } from '../../types/contracts';
import type { ThemeMode } from '../../hooks/useProjectionHud';
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
    theme: ThemeMode;
    onToggleTheme: () => void;
}

/* ── Theme palette ───────────────────────────────────────────────────
 * S3 was originally a "dark stage, cream card" design — the card itself
 * stayed light regardless of the outer backdrop. Dark mode flips the
 * card to a slate/navy surface while keeping the same purple/red accents.
 */
const PALETTES = {
    light: {
        cardBg: '#F5F4F0',
        cardBorderOverlay: 'rgba(107, 94, 184, 0.20)',
        pillBg: 'rgba(245, 244, 240, 0.95)',
        pillBorderWs: 'rgba(107, 94, 184, 0.30)',
        pillBorderGesture: 'rgba(255, 61, 90, 0.34)',
        pillText: '#6B7080',
        sectionLabel: 'rgba(107, 94, 184, 0.85)',
        progressTrack: 'rgba(60, 55, 100, 0.07)',
        primaryText: '#1E1B3A',
        secondaryText: 'rgba(30, 27, 58, 0.65)',
        secondaryTextDim: 'rgba(30, 27, 58, 0.45)',
        divider: 'rgba(40, 38, 72, 0.08)',
        panelBaseBg: 'rgba(60, 55, 100, 0.04)',
        panelOverlayBg: 'rgba(40, 38, 72, 0.08)',
        panelOverlayBorder: 'rgba(40, 38, 72, 0.10)',
        glowOuter: 'rgba(107, 94, 184, 0.06)',
        glowMiddle: 'rgba(107, 94, 184, 0.10)',
        backBtnBg: 'rgba(40, 38, 72, 0.08)',
        backBtnBorder: 'rgba(40, 38, 72, 0.10)',
        chevronColor: 'rgba(107, 94, 184, 0.70)',
        ingredientSquareBg: 'rgba(40, 38, 72, 0.08)',
        ingredientSquareBorder: 'rgba(40, 38, 72, 0.10)',
        utensilDot: 'rgba(107, 94, 184, 0.55)',
        utensilText: '#6B7080',
        notesBg: 'rgba(40, 38, 72, 0.08)',
        notesBorder: 'rgba(40, 38, 72, 0.10)',
        notesText: 'rgba(30, 27, 58, 0.45)',
        switcherBg: 'rgba(40, 38, 72, 0.08)',
        switcherBorder: 'rgba(40, 38, 72, 0.10)',
        switcherIcon: 'rgba(107, 94, 184, 0.85)',
        cancelBg: 'rgba(255, 61, 90, 0.08)',
        cancelBorder: 'rgba(255, 61, 90, 0.35)',
        cancelText: '#E11D48',
    },
    dark: {
        cardBg: '#181A26',
        cardBorderOverlay: 'rgba(155, 143, 212, 0.22)',
        pillBg: 'rgba(24, 26, 38, 0.90)',
        pillBorderWs: 'rgba(155, 143, 212, 0.30)',
        pillBorderGesture: 'rgba(255, 90, 106, 0.40)',
        pillText: '#B7BEDB',
        sectionLabel: 'rgba(178, 168, 224, 0.90)',
        progressTrack: 'rgba(255, 255, 255, 0.08)',
        primaryText: '#F1F0F7',
        secondaryText: 'rgba(241, 240, 247, 0.68)',
        secondaryTextDim: 'rgba(241, 240, 247, 0.42)',
        divider: 'rgba(255, 255, 255, 0.08)',
        panelBaseBg: 'rgba(255, 255, 255, 0.04)',
        panelOverlayBg: 'rgba(255, 255, 255, 0.03)',
        panelOverlayBorder: 'rgba(255, 255, 255, 0.08)',
        glowOuter: 'rgba(155, 143, 212, 0.10)',
        glowMiddle: 'rgba(155, 143, 212, 0.14)',
        backBtnBg: 'rgba(255, 255, 255, 0.06)',
        backBtnBorder: 'rgba(255, 255, 255, 0.10)',
        chevronColor: 'rgba(178, 168, 224, 0.85)',
        ingredientSquareBg: 'rgba(255, 255, 255, 0.05)',
        ingredientSquareBorder: 'rgba(255, 255, 255, 0.09)',
        utensilDot: 'rgba(178, 168, 224, 0.65)',
        utensilText: '#B7BEDB',
        notesBg: 'rgba(255, 255, 255, 0.04)',
        notesBorder: 'rgba(255, 255, 255, 0.08)',
        notesText: 'rgba(241, 240, 247, 0.42)',
        switcherBg: 'rgba(255, 255, 255, 0.06)',
        switcherBorder: 'rgba(255, 255, 255, 0.14)',
        switcherIcon: '#F1F0F7',
        cancelBg: 'rgba(255, 90, 106, 0.12)',
        cancelBorder: 'rgba(255, 90, 106, 0.40)',
        cancelText: '#FF8FA3',
    },
};

type Palette = typeof PALETTES.light;

/** Sun/moon toggle button — click, or thumbs-up gesture, switches theme */
function ThemeSwitcher({ theme, onToggle, palette }: { theme: ThemeMode; onToggle: () => void; palette: Palette }) {
    return (
        <button
            onClick={onToggle}
            aria-label="Toggle dark mode"
            style={{
                width: 41.60, height: 41.60,
                background: palette.switcherBg,
                borderRadius: 10,
                border: `0.80px ${palette.switcherBorder} solid`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.18s ease, border-color 0.18s ease',
            }}
        >
            {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke={palette.switcherIcon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4.5" stroke={palette.switcherIcon} strokeWidth="2" />
                    <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18 18l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18 6l1.77-1.77" stroke={palette.switcherIcon} strokeWidth="2" strokeLinecap="round" />
                </svg>
            )}
        </button>
    );
}

function formatStopwatch(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TimerRingProps {
    value: string;
    progress: number;
    alert?: boolean;
    valueColor: string;
    controls?: React.ReactNode;
}

function TimerRing({ value, progress, alert = false, valueColor, controls }: TimerRingProps) {
    const ringColor = alert ? '#FF3D5A' : '#6B5EB8';
    const totalLength = 427.26;
    const dash = (progress / 100) * totalLength;

    const ringContent = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                        animate={{ strokeDasharray: `${dash} ${totalLength}` }}
                        transition={{ duration: 0.35, ease: 'linear' }}
                    />
                </svg>

                {/* Center text */}
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        color: valueColor,
                        fontSize: 26,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        lineHeight: '26px',
                        letterSpacing: 1.30,
                    }}>{value}</div>
                </div>
            </div>

            {controls && <div style={{ marginTop: 10 }}>{controls}</div>}
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

/* ─── Panel shared styles (theme-dependent) ──────────────────────── */
function panelBase(palette: Palette): React.CSSProperties {
    return {
        position: 'relative',
        background: palette.panelBaseBg,
        borderRadius: 24,
        overflow: 'hidden',
        flexShrink: 0,
    };
}

function panelOverlay(palette: Palette): React.CSSProperties {
    return {
        position: 'absolute',
        inset: 0,
        background: palette.panelOverlayBg,
        borderRadius: 24,
        border: `0.80px ${palette.panelOverlayBorder} solid`,
        pointerEvents: 'none',
    };
}

function sectionLabelStyle(palette: Palette): React.CSSProperties {
    return {
        color: palette.sectionLabel,
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 400,
        lineHeight: '18px',
        letterSpacing: 3.60,
    };
}

function dividerStyle(palette: Palette): React.CSSProperties {
    return {
        height: 1,
        background: palette.divider,
    };
}

/* ─── Main component ─────────────────────────────────────────────── */
export const RecipeHud: React.FC<RecipeHudProps> = ({
    recipe,
    stepNumber,
    totalSteps,
    instruction,
    progressPercent,
    onNextStep,
    onPreviousStep,
    onOpenMenu,
    isConnected,
    lastAction,
    theme,
    onToggleTheme,
}) => {
    const palette = PALETTES[theme];
    const PANEL_BASE = panelBase(palette);
    const PANEL_OVERLAY = panelOverlay(palette);
    const SECTION_LABEL = sectionLabelStyle(palette);
    const DIVIDER = dividerStyle(palette);

    /* ── Timer 1: ad-hoc task timer (dough rising, frying, ...) ──────
     * Manual stopwatch — user starts/stops/resets it. The ring loops
     * once a minute purely to show it's alive; there's no fixed target.
     */
    const [taskSeconds, setTaskSeconds] = useState(0);
    const [taskRunning, setTaskRunning] = useState(false);

    useEffect(() => {
        if (!taskRunning) return;
        const id = setInterval(() => setTaskSeconds(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [taskRunning]);

    const toggleTask = useCallback(() => setTaskRunning(running => !running), []);
    const resetTask = useCallback(() => {
        setTaskRunning(false);
        setTaskSeconds(0);
    }, []);

    /* ── Timer 2: overall cooking time — starts the moment Session 3
     * mounts, runs for as long as the user is cooking, no controls.
     */
    const [cookSeconds, setCookSeconds] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setCookSeconds(s => s + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const taskValue = formatStopwatch(taskSeconds);
    const cookValue = formatStopwatch(cookSeconds);
    const taskProgress = ((taskSeconds % 60) / 60) * 100;
    const cookProgress = recipe.cook_time_minutes
        ? Math.min(100, (cookSeconds / 60 / recipe.cook_time_minutes) * 100)
        : ((cookSeconds % 300) / 300) * 100;

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
                background: palette.cardBg,
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
                    border: `0.80px ${palette.cardBorderOverlay} solid`,
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
                        gap: 10,
                    }}>
                        {/* WEBSOCKET CONNECTED pill */}
                        <div style={{
                            background: palette.pillBg,
                            boxShadow: '0px 2px 12px rgba(100, 90, 170, 0.12)',
                            borderRadius: 10,
                            border: `0.80px ${palette.pillBorderWs} solid`,
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
                                color: palette.pillText,
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
                            background: palette.pillBg,
                            boxShadow: '0px 2px 12px rgba(100, 90, 170, 0.12)',
                            borderRadius: 10,
                            border: `0.80px ${palette.pillBorderGesture} solid`,
                            paddingTop: 12.55,
                            paddingBottom: 12.55,
                            paddingLeft: 12.80,
                            paddingRight: 12.80,
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: 41.60,
                            boxSizing: 'border-box',
                            flex: 1, minWidth: 0,
                        }}>
                            <span style={{
                                color: palette.pillText,
                                fontSize: 11,
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 700,
                                lineHeight: '16.50px',
                                letterSpacing: 1.10,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{gestureText}</span>
                        </div>

                        {/* Theme switcher */}
                        <ThemeSwitcher theme={theme} onToggle={onToggleTheme} palette={palette} />

                        {/* Cancel — back to Session 1 recipe menu */}
                        <button
                            onClick={onOpenMenu}
                            aria-label="Cancel and return to recipe menu"
                            style={{
                                height: 41.60, paddingLeft: 14, paddingRight: 16,
                                background: palette.cancelBg,
                                borderRadius: 10,
                                border: `0.80px ${palette.cancelBorder} solid`,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                                flexShrink: 0,
                                transition: 'background 0.18s ease, border-color 0.18s ease',
                            }}
                        >
                            <X size={14} color={palette.cancelText} strokeWidth={2.2} />
                            <span style={{
                                color: palette.cancelText,
                                fontSize: 11,
                                fontFamily: 'Inter, sans-serif',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                lineHeight: '16.50px',
                                letterSpacing: 1.10,
                                whiteSpace: 'nowrap',
                            }}>CANCEL</span>
                        </button>
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
                            background: palette.progressTrack,
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
                            color: palette.sectionLabel,
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
                                value={taskValue}
                                progress={taskProgress}
                                valueColor={palette.primaryText}
                                alert={taskRunning}
                                controls={
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                        <button
                                            onClick={toggleTask}
                                            aria-label={taskRunning ? 'Pause task timer' : 'Start task timer'}
                                            style={{
                                                width: 34, height: 34, borderRadius: '50%',
                                                background: taskRunning ? '#FF3D5A' : '#6B5EB8',
                                                border: 'none', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'background 0.2s ease',
                                            }}
                                        >
                                            {taskRunning
                                                ? <Pause size={14} color="white" fill="white" />
                                                : <Play size={14} color="white" fill="white" />}
                                        </button>
                                        <button
                                            onClick={resetTask}
                                            aria-label="Reset task timer"
                                            style={{
                                                width: 34, height: 34, borderRadius: '50%',
                                                background: palette.backBtnBg,
                                                border: `0.80px ${palette.backBtnBorder} solid`,
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}
                                        >
                                            <RotateCcw size={14} color={palette.chevronColor} />
                                        </button>
                                    </div>
                                }
                            />

                            <TimerRing
                                value={cookValue}
                                progress={cookProgress}
                                valueColor={palette.primaryText}
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
                                color: palette.primaryText,
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
                                color: palette.secondaryText,
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
                                background: palette.glowOuter,
                                borderRadius: '50%',
                                filter: 'blur(60px)',
                            }} />
                            {/* Middle glow blob */}
                            <div style={{
                                position: 'absolute',
                                width: 284,
                                height: 284,
                                background: palette.glowMiddle,
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
                                    background: palette.backBtnBg,
                                    borderRadius: 999,
                                    border: `0.80px ${palette.backBtnBorder} solid`,
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
                                    color={palette.chevronColor}
                                    strokeWidth={1.8}
                                />
                                <span style={{
                                    color: palette.secondaryText,
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
                                            background: palette.ingredientSquareBg,
                                            borderRadius: 14,
                                            border: `0.80px ${palette.ingredientSquareBorder} solid`,
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
                                            background: palette.utensilDot,
                                            flexShrink: 0,
                                        }} />
                                        <span style={{
                                            color: palette.utensilText,
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
                                        color: palette.primaryText,
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
                                        color: palette.primaryText,
                                        fontSize: 11,
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 400,
                                        lineHeight: '16.50px',
                                    }}>Right Hand:</span>
                                    <span style={{
                                        color: palette.utensilText,
                                        fontSize: 11,
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 400,
                                        lineHeight: '16.50px',
                                    }}>Miss</span>
                                </div>
                            </div>

                            {/* Notes box */}
                            <div style={{
                                background: palette.notesBg,
                                borderRadius: 14,
                                border: `0.80px ${palette.notesBorder} solid`,
                                padding: '12.80px',
                                marginTop: 'auto',
                            }}>
                                <span style={{
                                    color: palette.notesText,
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
