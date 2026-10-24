import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { ChevronLeft, Hand, Pause, Play, Pointer, RotateCcw, ThumbsUp, X, type LucideIcon } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { GestureAction, Ingredient, Recipe, VoiceCommandMessage, VoiceState } from '../../types/contracts';
import type { ThemeMode } from '../../hooks/useProjectionHud';
import { useIdleActivity } from '../../hooks/useIdleActivity';
import { playSfx } from '../../audio/sfx';
import svgPaths from '../svgTimerRings';
import { tipsForStep } from './cookingTips';
import { StoveZoneAmbient } from './StoveZoneAmbient';
import { TipBubble } from './TipBubble';
import { VoiceStatusIndicator } from './VoiceStatusIndicator';

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
    theme: ThemeMode;
    onToggleTheme: () => void;
    voiceState: VoiceState;
    voiceCommand: VoiceCommandMessage | null;
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
        switcherBg: 'rgba(40, 38, 72, 0.08)',
        switcherBorder: 'rgba(40, 38, 72, 0.10)',
        switcherIcon: 'rgba(107, 94, 184, 0.85)',
        cancelBg: 'rgba(255, 61, 90, 0.08)',
        cancelBorder: 'rgba(255, 61, 90, 0.35)',
        cancelText: '#E11D48',
        ingredientAvatarBg: 'rgba(107, 94, 184, 0.12)',
        ingredientAvatarText: '#6B5EB8',
        ingredientAmount: '#6B5EB8',
        guidePanelBg: 'rgba(107, 94, 184, 0.05)',
        guidePanelBorder: 'rgba(107, 94, 184, 0.22)',
        guideLabel: '#6B5EB8',
        guideDesc: 'rgba(30, 27, 58, 0.60)',
        guideIcon: 'rgba(107, 94, 184, 0.85)',
        guideRowRest: 'rgba(107, 94, 184, 0)',
        guideRowHighlight: 'rgba(107, 94, 184, 0.12)',
        guideRowFlash: 'rgba(107, 94, 184, 0.26)',
        emberA: '#9B8FD4',
        emberB: '#FF8FA3',
        bubbleBg: '#FFFFFF',
        bubbleBorder: 'rgba(107, 94, 184, 0.30)',
        bubbleShadow: 'rgba(107, 94, 184, 0.20)',
        bubbleHeading: '#6B5EB8',
        bubbleText: '#1E1B3A',
        bubbleFace: '#FFE1C2',
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
        switcherBg: 'rgba(255, 255, 255, 0.06)',
        switcherBorder: 'rgba(255, 255, 255, 0.14)',
        switcherIcon: '#F1F0F7',
        cancelBg: 'rgba(255, 90, 106, 0.12)',
        cancelBorder: 'rgba(255, 90, 106, 0.40)',
        cancelText: '#FF8FA3',
        ingredientAvatarBg: 'rgba(155, 143, 212, 0.16)',
        ingredientAvatarText: '#B2A8E0',
        ingredientAmount: '#B2A8E0',
        guidePanelBg: 'rgba(155, 143, 212, 0.06)',
        guidePanelBorder: 'rgba(155, 143, 212, 0.24)',
        guideLabel: '#B2A8E0',
        guideDesc: 'rgba(241, 240, 247, 0.62)',
        guideIcon: '#B2A8E0',
        guideRowRest: 'rgba(155, 143, 212, 0)',
        guideRowHighlight: 'rgba(155, 143, 212, 0.16)',
        guideRowFlash: 'rgba(155, 143, 212, 0.32)',
        emberA: '#B2A8E0',
        emberB: '#FF8FA3',
        bubbleBg: '#232637',
        bubbleBorder: 'rgba(155, 143, 212, 0.34)',
        bubbleShadow: 'rgba(0, 0, 0, 0.45)',
        bubbleHeading: '#B2A8E0',
        bubbleText: '#F1F0F7',
        bubbleFace: '#FFE1C2',
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
    caption: string;
    alert?: boolean;
    valueColor: string;
    captionColor: string;
    /** Right side of the caption row: timer controls or the target time. */
    accessory?: React.ReactNode;
}

/** Height of the caption row under each ring. Both rings share it, so they shrink equally. */
const TIMER_CAPTION_ROW = 34;

/** Room for the tip bubble with a two-line tip (8 + 14 + 2 × 18 + 8). */
const TIP_BUBBLE_SLOT = 66;

function TimerRing({ value, progress, caption, alert = false, valueColor, captionColor, accessory }: TimerRingProps) {
    const ringColor = alert ? '#FF3D5A' : '#6B5EB8';
    const totalLength = 427.26;
    const dash = (progress / 100) * totalLength;

    return (
        // The alert frame is always mounted (transparent at rest), so starting
        // the timer fades it in instead of shifting the layout.
        <div style={{
            flex: '0 1 auto', minHeight: 0,
            display: 'flex', flexDirection: 'column', gap: 6,
            padding: '8px 6px',
            borderRadius: 16,
            background: alert ? 'rgba(255, 61, 90, 0.06)' : 'rgba(255, 61, 90, 0)',
            border: `0.80px solid ${alert ? 'rgba(255, 61, 90, 0.28)' : 'rgba(255, 61, 90, 0)'}`,
            boxShadow: `0px 0px 30px rgba(255, 61, 90, ${alert ? 0.12 : 0})`,
            transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        }}>
            {/* Ring shrinks from 168px on short screens; the time is SVG text so it scales with it. */}
            <svg
                viewBox="0 0 168 168"
                fill="none"
                style={{ width: '100%', height: 168, minHeight: 0, flexShrink: 1 }}
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
                {/* Center text */}
                <text
                    x="84" y="84"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={valueColor}
                    style={{
                        fontSize: 26,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        letterSpacing: 1.30,
                    }}
                >{value}</text>
            </svg>

            {/* Caption row */}
            <div style={{
                height: TIMER_CAPTION_ROW, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '0 2px',
            }}>
                <span style={{
                    color: captionColor,
                    fontSize: 10.40,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    lineHeight: '15.60px',
                    letterSpacing: 1.20,
                    whiteSpace: 'nowrap',
                }}>{caption}</span>
                {accessory}
            </div>
        </div>
    );
}

function formatAmount(ing: Ingredient): string {
    if (!ing.amount && !ing.unit) return '';
    if (!ing.unit) return String(ing.amount);
    return `${ing.amount}${ing.unit}`;
}

/** One ingredient in the right panel list */
function IngredientLine({ ing, palette }: { ing: Ingredient; palette: Palette }) {
    const amount = formatAmount(ing);
    return (
        <div
            title={amount ? `${ing.name} — ${amount}` : ing.name}
            style={{
                // Shrinks from 30px toward 22px on short screens before the list scrolls.
                height: 30, minHeight: 22, flexShrink: 1,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 8px',
                background: palette.ingredientSquareBg,
                borderRadius: 10,
                border: `0.80px ${palette.ingredientSquareBorder} solid`,
            }}
        >
            <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: palette.ingredientAvatarBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <span style={{ color: palette.ingredientAvatarText, fontSize: 9.60, fontFamily: 'Inter, sans-serif', fontWeight: 700, lineHeight: '14px' }}>
                    {(ing.name[0] ?? '?').toUpperCase()}
                </span>
            </div>
            <span style={{
                flex: 1, minWidth: 0,
                color: palette.primaryText,
                fontSize: 12,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                lineHeight: '18px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{ing.name}</span>
            {amount && (
                <span style={{
                    flexShrink: 0,
                    color: palette.ingredientAmount,
                    fontSize: 10.40,
                    fontFamily: "'Cousine', 'Courier New', monospace",
                    lineHeight: '15.60px',
                    whiteSpace: 'nowrap',
                }}>{amount}</span>
            )}
        </div>
    );
}

/** Gesture Guide rows (the cooking gestures the backend interpreter emits).
 *  `action` lets a row flash when that gesture fires. */
const GUIDE_ROWS: { id: string; label: string; description: string; Icon: LucideIcon; mirrored?: boolean; action: GestureAction }[] = [
    { id: 'next', label: 'NEXT', description: 'Right index up', Icon: Pointer, action: 'NEXT_STEP' },
    { id: 'prev', label: 'PREV', description: 'Left index up', Icon: Pointer, mirrored: true, action: 'PREVIOUS_STEP' },
    { id: 'menu', label: 'MENU', description: 'Open palm', Icon: Hand, action: 'BACK_TO_MENU' },
    { id: 'theme', label: 'THEME', description: 'Thumbs up', Icon: ThumbsUp, action: 'TOGGLE_THEME' },
];

/** Voice phrases for this screen (the backend maps them for `ui_mode: cooking`). */
const VOICE_PHRASES = ['next step', 'go back', 'read step', 'start / pause / reset timer', 'black / white', 'back to menu'];

/** How long each Gesture Guide row stays highlighted while the screen is idle. */
const ATTRACT_STEP_MS = 2400;

/** Step text slides in from the side the user is moving toward. */
const STEP_VARIANTS: Variants = {
    enter: (direction: number) => ({ opacity: 0, x: direction * 28 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
    exit: (direction: number) => ({ opacity: 0, x: direction * -28, transition: { duration: 0.14, ease: 'easeIn' } }),
};

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
    theme,
    onToggleTheme,
    voiceState,
    voiceCommand,
}) => {
    const palette = PALETTES[theme];
    const PANEL_BASE = panelBase(palette);
    const PANEL_OVERLAY = panelOverlay(palette);
    const SECTION_LABEL = sectionLabelStyle(palette);
    const DIVIDER = dividerStyle(palette);

    /* ── Idle / interaction state ── */
    const { isIdle, isDetecting, gesturePulse, lastGesture, markActivity } = useIdleActivity();
    const reduced = useReducedMotion() ?? false;
    const ambient = isIdle && !reduced;

    // While idle, walk a highlight through the Gesture Guide rows.
    const [attractIndex, setAttractIndex] = useState(0);
    useEffect(() => {
        if (!isIdle) return;
        const timer = window.setInterval(() => {
            setAttractIndex(index => (index + 1) % GUIDE_ROWS.length);
        }, ATTRACT_STEP_MS);
        return () => window.clearInterval(timer);
    }, [isIdle]);

    // Direction of the latest step change (click or gesture) — "adjusting
    // state during render" pattern, so no setState inside an effect.
    const [stepTrack, setStepTrack] = useState({ step: stepNumber, direction: 1, changes: 0 });
    if (stepTrack.step !== stepNumber) {
        setStepTrack({
            step: stepNumber,
            direction: stepNumber > stepTrack.step ? 1 : -1,
            changes: stepTrack.changes + 1,
        });
    }
    const isFirstStep = stepNumber === 1;
    const isLastStep = stepNumber === totalSteps;

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

    // Counts timer start / pause / reset events (click or voice); each one plays a sound.
    const [timerEvents, setTimerEvents] = useState(0);

    const toggleTask = useCallback(() => {
        setTaskRunning(running => !running);
        setTimerEvents(n => n + 1);
    }, []);
    const resetTask = useCallback(() => {
        setTaskRunning(false);
        setTaskSeconds(0);
        setTimerEvents(n => n + 1);
    }, []);

    useEffect(() => {
        if (timerEvents > 0) playSfx('timer');
    }, [timerEvents]);

    // One sound per step movement, whatever moved it (button, gesture, voice).
    useEffect(() => {
        if (stepTrack.changes > 0) playSfx('step');
    }, [stepTrack.changes]);

    /* ── Timer 2: overall cooking time — starts the moment Session 3
     * mounts, runs for as long as the user is cooking, no controls.
     */
    const [cookSeconds, setCookSeconds] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setCookSeconds(s => s + 1), 1000);
        return () => clearInterval(id);
    }, []);

    /* ── Voice: timer and read-aloud commands ──────────────────────
     * Navigation commands are handled in useProjectionHud; this screen
     * owns the task timer and the step text, so it handles these.
     * "Adjusting state during render" pattern — the command present when
     * Cooking opens is not for this screen.
     */
    const [voiceTrack, setVoiceTrack] = useState({ command: voiceCommand, readRequests: 0 });
    if (voiceTrack.command !== voiceCommand) {
        const action = voiceCommand?.data.action;
        // Don't let the read-aloud step trigger commands through the mic.
        const ignored = window.speechSynthesis?.speaking ?? false;
        setVoiceTrack({
            command: voiceCommand,
            readRequests: voiceTrack.readRequests + (!ignored && action === 'READ_STEP' ? 1 : 0),
        });
        if (!ignored && action === 'START_TIMER') setTaskRunning(true);
        if (!ignored && action === 'PAUSE_TIMER') setTaskRunning(false);
        if (!ignored && action === 'RESET_TIMER') {
            setTaskRunning(false);
            setTaskSeconds(0);
        }
        if (!ignored && (action === 'START_TIMER' || action === 'PAUSE_TIMER' || action === 'RESET_TIMER')) {
            setTimerEvents(n => n + 1);
        }
    }

    // Reading aloud is a side effect, so it runs after the render that requested it.
    const readStepRef = useRef({ stepNumber, instruction });
    useEffect(() => {
        readStepRef.current = { stepNumber, instruction };
    }, [stepNumber, instruction]);
    useEffect(() => {
        if (voiceTrack.readRequests === 0 || !window.speechSynthesis) return;
        const { stepNumber: step, instruction: text } = readStepRef.current;
        const utterance = new SpeechSynthesisUtterance(`Step ${step}. ${text ?? ''}`);
        utterance.lang = 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }, [voiceTrack.readRequests]);

    // Stop reading aloud when leaving the screen.
    useEffect(() => () => window.speechSynthesis?.cancel(), []);

    const taskValue = formatStopwatch(taskSeconds);
    const cookValue = formatStopwatch(cookSeconds);
    const taskProgress = ((taskSeconds % 60) / 60) * 100;
    const cookProgress = recipe.cook_time_minutes
        ? Math.min(100, (cookSeconds / 60 / recipe.cook_time_minutes) * 100)
        : ((cookSeconds % 300) / 300) * 100;

    // The backend sends a gesture action on a single frame only, so show the
    // last recognized one rather than the latest frame's action.
    const gestureText = lastGesture
        ? `LAST GESTURE: ${lastGesture.replace(/_/g, ' ')}`
        : 'LAST GESTURE: WAITING';

    const timing = [
        recipe.prep_time_minutes ? `Prep ${recipe.prep_time_minutes} min` : null,
        recipe.cook_time_minutes ? `Cook ${recipe.cook_time_minutes} min` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div
            onPointerMove={markActivity}
            onPointerDown={markActivity}
            style={{
                width: '100%',
                height: '100%',
                background: '#0A0F1A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
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
                            position: 'relative', isolation: 'isolate', overflow: 'hidden',
                        }}>
                            {/* Flashes once per recognized gesture */}
                            {gesturePulse > 0 && (
                                <motion.div
                                    key={gesturePulse}
                                    initial={{ opacity: 1 }}
                                    animate={{ opacity: 0 }}
                                    transition={{ duration: 1.2, ease: 'easeOut' }}
                                    style={{ position: 'absolute', inset: 0, zIndex: -1, background: palette.guideRowFlash }}
                                />
                            )}
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

                        {/* Voice mic status + last heard phrase */}
                        <VoiceStatusIndicator
                            state={voiceState}
                            command={voiceCommand}
                            height={41.60}
                            colors={{ bg: palette.pillBg, border: palette.pillBorderWs, text: palette.pillText, accent: palette.guideLabel }}
                        />

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

                    {/* ──── LEFT: TIMERS + GESTURE GUIDE ──────────── *
                     * The guide keeps its height; the timer rings shrink
                     * to make room on short screens.
                     * ─────────────────────────────────────────────── */}
                    <div style={{
                        width: 220, flexShrink: 0, minHeight: 0,
                        display: 'flex', flexDirection: 'column', gap: 12,
                    }}>
                        <div style={{ ...PANEL_BASE, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minHeight: 0 }}>
                            <div style={{
                                padding: 16.80,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                height: '100%',
                                boxSizing: 'border-box',
                            }}>
                                <div style={{ ...SECTION_LABEL, flexShrink: 0 }}>TIMERS</div>

                                <TimerRing
                                    value={taskValue}
                                    progress={taskProgress}
                                    caption="TASK TIMER"
                                    valueColor={palette.primaryText}
                                    captionColor={palette.sectionLabel}
                                    alert={taskRunning}
                                    accessory={
                                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
                                    caption="COOK TIME"
                                    valueColor={palette.primaryText}
                                    captionColor={palette.sectionLabel}
                                    accessory={recipe.cook_time_minutes ? (
                                        <span style={{
                                            color: palette.secondaryTextDim,
                                            fontSize: 10.40,
                                            fontFamily: "'Cousine', 'Courier New', monospace",
                                            lineHeight: '15.60px',
                                            whiteSpace: 'nowrap',
                                        }}>/ {formatStopwatch(recipe.cook_time_minutes * 60)}</span>
                                    ) : undefined}
                                />
                            </div>
                            <div style={PANEL_OVERLAY} />
                        </div>

                        {/* GESTURE GUIDE — idle highlight cycles; a row flashes when its gesture fires */}
                        <div style={{
                            flexShrink: 0,
                            background: palette.guidePanelBg,
                            borderRadius: 24,
                            border: `0.80px ${palette.guidePanelBorder} solid`,
                            padding: '12px 10px 10px',
                        }}>
                            <div style={{ ...SECTION_LABEL, marginBottom: 6, paddingLeft: 6 }}>GESTURE GUIDE</div>
                            {GUIDE_ROWS.map((row, i) => (
                                <Fragment key={row.id}>
                                    {i > 0 && <div style={{ ...DIVIDER, margin: '2px 8px' }} />}
                                    <motion.div
                                        animate={{ backgroundColor: isIdle && attractIndex === i ? palette.guideRowHighlight : palette.guideRowRest }}
                                        transition={{ duration: 0.4 }}
                                        style={{
                                            position: 'relative', isolation: 'isolate',
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '4px 6px', borderRadius: 10,
                                        }}
                                    >
                                        {row.action === lastGesture && gesturePulse > 0 && (
                                            <motion.div
                                                key={gesturePulse}
                                                initial={{ opacity: 1 }}
                                                animate={{ opacity: 0 }}
                                                transition={{ duration: 1.2, ease: 'easeOut' }}
                                                style={{ position: 'absolute', inset: 0, zIndex: -1, borderRadius: 10, background: palette.guideRowFlash }}
                                            />
                                        )}
                                        <row.Icon
                                            size={16}
                                            color={palette.guideIcon}
                                            strokeWidth={1.6}
                                            style={{ flexShrink: 0, transform: row.mirrored ? 'scaleX(-1)' : undefined }}
                                        />
                                        <span style={{
                                            width: 44, flexShrink: 0,
                                            color: palette.guideLabel,
                                            fontSize: 11.20,
                                            fontFamily: 'Inter, sans-serif',
                                            fontWeight: 700,
                                            lineHeight: '16.80px',
                                            letterSpacing: 0.67,
                                        }}>{row.label}</span>
                                        <span style={{
                                            color: palette.guideDesc,
                                            fontSize: 10.40,
                                            fontFamily: 'Inter, sans-serif',
                                            fontWeight: 400,
                                            lineHeight: '15.60px',
                                            whiteSpace: 'nowrap',
                                        }}>{row.description}</span>
                                    </motion.div>
                                </Fragment>
                            ))}
                        </div>
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
                            {/* Step text slides in from the side the user is moving toward */}
                            <AnimatePresence mode="wait" initial={false} custom={stepTrack.direction}>
                                <motion.div
                                    key={stepNumber}
                                    custom={stepTrack.direction}
                                    variants={STEP_VARIANTS}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                >
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
                                </motion.div>
                            </AnimatePresence>

                            {/* Tip bubble — above the stove zone, where pans and hands
                             * shadow the projection. Fixed height so the pop out/in
                             * never shifts the layout. */}
                            <div style={{
                                height: TIP_BUBBLE_SLOT, marginTop: 12,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <TipBubble
                                    heading={`TIP · STEP ${stepNumber}`}
                                    lines={tipsForStep(recipe.instructions[stepNumber - 1], stepNumber - 1)}
                                    colors={{
                                        bg: palette.bubbleBg,
                                        border: palette.bubbleBorder,
                                        shadow: palette.bubbleShadow,
                                        heading: palette.bubbleHeading,
                                        text: palette.bubbleText,
                                        face: palette.bubbleFace,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={DIVIDER} />

                        {/* Stove concentric circles + idle / detection / gesture animation */}
                        <div style={{
                            flex: 1,
                            minHeight: 0,
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <StoveZoneAmbient
                                isIdle={isIdle}
                                isDetecting={isDetecting}
                                gesturePulse={gesturePulse}
                                glowOuter={palette.glowOuter}
                                glowMiddle={palette.glowMiddle}
                                emberColors={[palette.emberA, palette.emberB]}
                            />
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
                            <motion.button
                                onClick={onPreviousStep}
                                disabled={isFirstStep}
                                whileTap={isFirstStep ? undefined : { scale: 0.96 }}
                                style={{
                                    position: 'relative',
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
                                    cursor: isFirstStep ? 'not-allowed' : 'pointer',
                                    opacity: isFirstStep ? 0.45 : 1,
                                    transition: 'opacity 0.2s',
                                }}
                            >
                                {/* Ring burst each time the step goes back */}
                                {stepTrack.direction < 0 && stepTrack.changes > 0 && (
                                    <motion.span
                                        key={stepTrack.changes}
                                        initial={{ opacity: 0.85, scale: 1 }}
                                        animate={{ opacity: 0, scale: 1.3 }}
                                        transition={{ duration: 0.7, ease: 'easeOut' }}
                                        style={{ position: 'absolute', inset: -1, borderRadius: 999, border: `2px solid ${palette.chevronColor}`, pointerEvents: 'none' }}
                                    />
                                )}
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
                            </motion.button>

                            {/* Voice phrases for this screen (only while the mic is listening) */}
                            <div style={{
                                flex: 1, minWidth: 0, padding: '0 16px',
                                textAlign: 'center',
                                color: palette.secondaryTextDim,
                                fontSize: 10.40,
                                fontFamily: 'Inter, sans-serif',
                                lineHeight: '15.60px',
                            }}>
                                {voiceState === 'listening' && (
                                    <>
                                        Say{' '}
                                        {VOICE_PHRASES.map((phrase, i) => (
                                            <span key={phrase} style={{ whiteSpace: 'nowrap' }}>
                                                “{phrase}”{i < VOICE_PHRASES.length - 1 ? ' · ' : ''}
                                            </span>
                                        ))}
                                    </>
                                )}
                            </div>

                            {/* NEXT button — breathes while idle to invite the next step */}
                            <motion.button
                                onClick={onNextStep}
                                disabled={isLastStep}
                                whileTap={isLastStep ? undefined : { scale: 0.96 }}
                                animate={{
                                    boxShadow: ambient && !isLastStep
                                        ? ['0 0 0 0px rgba(107, 94, 184, 0)', '0 0 0 8px rgba(107, 94, 184, 0.22)', '0 0 0 0px rgba(107, 94, 184, 0)']
                                        : '0 0 0 0px rgba(107, 94, 184, 0)',
                                }}
                                transition={ambient && !isLastStep
                                    ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                                    : { duration: 0.3 }}
                                style={{
                                    position: 'relative',
                                    background: '#6B5EB8',
                                    borderRadius: 999,
                                    border: 'none',
                                    paddingTop: 8,
                                    paddingBottom: 8,
                                    paddingLeft: 28,
                                    paddingRight: 28,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    cursor: isLastStep ? 'not-allowed' : 'pointer',
                                    opacity: isLastStep ? 0.45 : 1,
                                    transition: 'opacity 0.2s',
                                }}
                            >
                                {/* Ring burst each time the step advances */}
                                {stepTrack.direction > 0 && stepTrack.changes > 0 && (
                                    <motion.span
                                        key={stepTrack.changes}
                                        initial={{ opacity: 0.85, scale: 1 }}
                                        animate={{ opacity: 0, scale: 1.3 }}
                                        transition={{ duration: 0.7, ease: 'easeOut' }}
                                        style={{ position: 'absolute', inset: -1, borderRadius: 999, border: '2px solid #6B5EB8', pointerEvents: 'none' }}
                                    />
                                )}
                                <span style={{
                                    color: '#F5F4F0',
                                    fontSize: 14,
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 500,
                                    lineHeight: '21px',
                                    letterSpacing: 0.70,
                                }}>NEXT</span>
                            </motion.button>
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
                            {/* INGREDIENTS — rows shrink first, then the list scrolls */}
                            <div style={{ flex: '0 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ ...SECTION_LABEL, marginBottom: 10, flexShrink: 0 }}>
                                    INGREDIENTS
                                </div>
                                <div style={{
                                    flex: '0 1 auto', minHeight: 0,
                                    overflowY: 'auto',
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: `${palette.ingredientSquareBorder} transparent`,
                                    display: 'flex', flexDirection: 'column', gap: 4,
                                }}>
                                    {recipe.ingredients.map((ing, i) => (
                                        <IngredientLine key={i} ing={ing} palette={palette} />
                                    ))}
                                </div>
                            </div>

                            {/* UTENSILS */}
                            <div style={{ flexShrink: 0 }}>
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
                            <div style={{ flexShrink: 0 }}>
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

                            {/* Details box — recipe timing */}
                            {timing && (
                                <div style={{
                                    background: palette.notesBg,
                                    borderRadius: 14,
                                    border: `0.80px ${palette.notesBorder} solid`,
                                    padding: '12.80px',
                                    marginTop: 'auto',
                                    flexShrink: 0,
                                }}>
                                    <span style={{
                                        color: palette.secondaryText,
                                        fontSize: 12,
                                        fontFamily: 'Inter, sans-serif',
                                        fontWeight: 400,
                                        lineHeight: '19.50px',
                                    }}>{timing}</span>
                                </div>
                            )}
                        </div>
                        <div style={PANEL_OVERLAY} />
                    </div>
                </div>
            </div>
        </div>
    );
};
