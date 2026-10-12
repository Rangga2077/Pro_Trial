import { motion, useReducedMotion } from 'framer-motion';
import { Fragment, useEffect, useState } from 'react';
import { Hand } from 'lucide-react';
import type { GestureAction, Ingredient, Recipe, VoiceCommandMessage, VoiceState } from '../../types/contracts';
import type { ThemeMode } from '../../hooks/useProjectionHud';
import { useIdleActivity } from '../../hooks/useIdleActivity';
import { sharedLayoutIds } from './screenTransitions';
import { ScanZoneAmbient } from './ScanZoneAmbient';
import { VoiceStatusIndicator } from './VoiceStatusIndicator';

export type ScanState = 'EMPTY' | 'DETECTING' | 'MATCHED' | 'WRONG ITEM' | 'READY';
const SCAN_STATES: ScanState[] = ['EMPTY', 'DETECTING', 'MATCHED', 'WRONG ITEM', 'READY'];

export interface IngredientCheckProps {
    recipe: Recipe;
    isConnected: boolean;
    lastAction: GestureAction | null;
    onReady: () => void;
    onBack: () => void;
    theme: ThemeMode;
    onToggleTheme: () => void;
    voiceState: VoiceState;
    voiceCommand: VoiceCommandMessage | null;
}

/* ── Theme palette ───────────────────────────────────────────────────
 * Every color used across this screen, keyed by theme. Session 2 was
 * originally a pure light design — dark mode gives it a slate/navy
 * equivalent while keeping the same accent hues (blue/purple/green).
 */
const PALETTES = {
    light: {
        shellBg: '#F1F5F9',
        cardBg: 'white',
        cardBorder: '#E2E8F0',
        sectionLabel: '#64748B',
        pillBg: '#F8FAFC',
        pillBorderWs: '#CBD5E1',
        pillBorderGesture: '#C4B5FD',
        pillText: '#475569',
        tabBgActive: '#EFF6FF',
        tabBgInactive: 'white',
        tabBorderActive: '#0284C7',
        tabBorderInactive: '#CBD5E1',
        tabTextActive: '#0284C7',
        tabTextInactive: '#64748B',
        progressTrack: '#E2E8F0',
        progressFill: '#0284C7',
        titleText: '#1143B7',
        badgeBg: '#EFF6FF',
        badgeBorder: '#93C5FD',
        badgeText: '#0284C7',
        leftPanelBg: '#FAFAFA',
        leftPanelBorder: '#E2E8F0',
        rowBg: 'white',
        rowBgChecked: '#F0FDF4',
        rowBorder: '#E2E8F0',
        rowBorderChecked: '#BBF7D0',
        checkboxBg: 'white',
        checkboxBgChecked: '#10B981',
        checkboxBorder: '#CBD5E1',
        checkboxBorderChecked: '#10B981',
        avatarBg: '#E0F2FE',
        avatarBgChecked: '#D1FAE5',
        avatarText: '#0284C7',
        avatarTextChecked: '#059669',
        nameText: '#0F172A',
        nameTextChecked: '#065F46',
        tagTextOptional: '#94A3B8',
        tagTextRequired: '#D97706',
        amountText: '#0284C7',
        utensilBg: 'white',
        utensilBorder: '#E2E8F0',
        utensilDot: '#93C5FD',
        utensilText: '#475569',
        utensilMetaText: '#94A3B8',
        centerPanelBg: '#F8FAFC',
        centerPanelBorder: '#E2E8F0',
        cameraZoneBg: '#F0F9FF',
        cameraZoneBorder: '#93C5FD',
        cornerBracket: '#0284C7',
        beamRgb: '2, 132, 199',
        particleA: '#7DD3FC',
        particleB: '#C4B5FD',
        gradientTint: 'linear-gradient(180deg, rgba(2,132,199,0.05) 0%, transparent 100%)',
        placeholderTitleText: '#0284C7',
        placeholderSubText: '#94A3B8',
        detectedPanelBg: '#FAFAFA',
        detectedPanelBorder: '#E2E8F0',
        detectedItemBg: '#FAFAFA',
        detectedItemBorder: '#E2E8F0',
        detectedItemText: '#CBD5E1',
        guidePanelBg: '#FAFAFF',
        guidePanelBorder: '#DDD6FE',
        guideHeaderText: '#7C3AED',
        guideBadgeBg: '#EDE9FE',
        guideBadgeBorder: '#C4B5FD',
        guideBadgeText: '#7C3AED',
        guideRowLabel: '#7C3AED',
        guideRowDesc: '#64748B',
        guideRowRest: 'rgba(124,58,237,0)',
        guideRowHighlight: 'rgba(124,58,237,0.10)',
        guideRowFlash: 'rgba(124,58,237,0.22)',
        guideDivider: '#F1F5F9',
        voiceBorderTop: '#EDE9FE',
        voiceText: '#7C3AED',
        proceedBg: '#7C3AED',
        proceedText: 'white',
        footerBorderTop: '#E2E8F0',
        footerBackText: '#94A3B8',
        footerRecipeText: '#0F172A',
        footerSessionText: '#64748B',
        footerRemainingText: '#94A3B8',
        wifiIcon: '#0284C7',
        gestureIcon: '#7C3AED',
        pointingIcon: '#A78BFA',
        micBars: '#C4B5FD',
        arrowIcon: '#CBD5E1',
        scannerIcon: '#93C5FD',
        switcherBg: '#F8FAFC',
        switcherBorder: '#CBD5E1',
        switcherIcon: '#475569',
    },
    dark: {
        shellBg: '#0B0F19',
        cardBg: '#151A26',
        cardBorder: 'rgba(255,255,255,0.08)',
        sectionLabel: '#8B96AB',
        pillBg: 'rgba(255,255,255,0.04)',
        pillBorderWs: 'rgba(255,255,255,0.14)',
        pillBorderGesture: '#5B4FA8',
        pillText: '#C4CCDA',
        tabBgActive: 'rgba(56,132,222,0.16)',
        tabBgInactive: 'rgba(255,255,255,0.03)',
        tabBorderActive: '#3B82F6',
        tabBorderInactive: 'rgba(255,255,255,0.14)',
        tabTextActive: '#7DB4F5',
        tabTextInactive: '#8B96AB',
        progressTrack: 'rgba(255,255,255,0.08)',
        progressFill: '#3B82F6',
        titleText: '#7DA6FF',
        badgeBg: 'rgba(56,132,222,0.14)',
        badgeBorder: '#3B6CB0',
        badgeText: '#7DB4F5',
        leftPanelBg: 'rgba(255,255,255,0.03)',
        leftPanelBorder: 'rgba(255,255,255,0.08)',
        rowBg: 'rgba(255,255,255,0.03)',
        rowBgChecked: 'rgba(16,185,129,0.10)',
        rowBorder: 'rgba(255,255,255,0.08)',
        rowBorderChecked: 'rgba(16,185,129,0.35)',
        checkboxBg: 'rgba(255,255,255,0.05)',
        checkboxBgChecked: '#10B981',
        checkboxBorder: 'rgba(255,255,255,0.20)',
        checkboxBorderChecked: '#10B981',
        avatarBg: 'rgba(56,132,222,0.16)',
        avatarBgChecked: 'rgba(16,185,129,0.18)',
        avatarText: '#7DB4F5',
        avatarTextChecked: '#34D399',
        nameText: '#F1F4F9',
        nameTextChecked: '#6EE7B7',
        tagTextOptional: '#6B7280',
        tagTextRequired: '#F0AA4E',
        amountText: '#7DB4F5',
        utensilBg: 'rgba(255,255,255,0.03)',
        utensilBorder: 'rgba(255,255,255,0.08)',
        utensilDot: '#3B6CB0',
        utensilText: '#C4CCDA',
        utensilMetaText: '#6B7280',
        centerPanelBg: 'rgba(255,255,255,0.02)',
        centerPanelBorder: 'rgba(255,255,255,0.08)',
        cameraZoneBg: 'rgba(56,132,222,0.06)',
        cameraZoneBorder: '#3B6CB0',
        cornerBracket: '#3B82F6',
        beamRgb: '59, 130, 246',
        particleA: '#BAE6FD',
        particleB: '#DDD6FE',
        gradientTint: 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, transparent 100%)',
        placeholderTitleText: '#7DB4F5',
        placeholderSubText: '#6B7280',
        detectedPanelBg: 'rgba(255,255,255,0.03)',
        detectedPanelBorder: 'rgba(255,255,255,0.08)',
        detectedItemBg: 'rgba(255,255,255,0.03)',
        detectedItemBorder: 'rgba(255,255,255,0.08)',
        detectedItemText: '#4B5563',
        guidePanelBg: 'rgba(124,58,237,0.06)',
        guidePanelBorder: '#4C3E8C',
        guideHeaderText: '#B79CF5',
        guideBadgeBg: 'rgba(124,58,237,0.18)',
        guideBadgeBorder: '#5B4FA8',
        guideBadgeText: '#B79CF5',
        guideRowLabel: '#B79CF5',
        guideRowDesc: '#8B96AB',
        guideRowRest: 'rgba(167,139,250,0)',
        guideRowHighlight: 'rgba(167,139,250,0.14)',
        guideRowFlash: 'rgba(167,139,250,0.28)',
        guideDivider: 'rgba(255,255,255,0.06)',
        voiceBorderTop: 'rgba(255,255,255,0.08)',
        voiceText: '#B79CF5',
        proceedBg: '#7C3AED',
        proceedText: 'white',
        footerBorderTop: 'rgba(255,255,255,0.08)',
        footerBackText: '#6B7280',
        footerRecipeText: '#F1F4F9',
        footerSessionText: '#8B96AB',
        footerRemainingText: '#6B7280',
        wifiIcon: '#7DB4F5',
        gestureIcon: '#B79CF5',
        pointingIcon: '#B79CF5',
        micBars: '#B79CF5',
        arrowIcon: '#6B7280',
        scannerIcon: '#7DB4F5',
        switcherBg: 'rgba(255,255,255,0.05)',
        switcherBorder: 'rgba(255,255,255,0.20)',
        switcherIcon: '#F1F4F9',
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
                width: 33.60, height: 33.60,
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke={palette.switcherIcon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4.5" stroke={palette.switcherIcon} strokeWidth="2" />
                    <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18 18l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18 6l1.77-1.77" stroke={palette.switcherIcon} strokeWidth="2" strokeLinecap="round" />
                </svg>
            )}
        </button>
    );
}

function isOptional(ing: Ingredient): boolean {
    return !!ing.notes?.toLowerCase().includes('optional');
}

function formatAmount(ing: Ingredient): string {
    if (!ing.amount && !ing.unit) return '';
    if (!ing.unit) return String(ing.amount);
    return `${ing.amount}${ing.unit}`;
}

/* ── Sub-components ─────────────────────────────────────────────────── */

/** Wi-Fi signal icon (3 arcs shrinking downward) */
function WifiIcon({ color = '#0284C7' }: { color?: string }) {
    return (
        <div style={{ width: 12, height: 12, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: 10, height: 1.91, left: 1, top: 2.50, position: 'absolute', outline: `1px ${color} solid`, outlineOffset: '-0.50px' }} />
            <div style={{ width: 7, height: 1.43, left: 2.50, top: 5, position: 'absolute', outline: `1px ${color} solid`, outlineOffset: '-0.50px' }} />
            <div style={{ width: 3.50, height: 0.71, left: 4.25, top: 7.50, position: 'absolute', outline: `1px ${color} solid`, outlineOffset: '-0.50px' }} />
        </div>
    );
}

/** Bar-chart / gesture icon (4 vertical bars) */
function GestureIcon({ color = '#7C3AED', size = 12 }: { color?: string; size?: number }) {
    const scale = size / 16;
    return (
        <div style={{ width: size, height: size, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: 2 * scale, height: 3.50 * scale, left: 7 * scale, top: 2 * scale, position: 'absolute', outline: `${scale}px ${color} solid`, outlineOffset: `-${0.50 * scale}px` }} />
            <div style={{ width: 2 * scale, height: 4 * scale, left: 5 * scale, top: 1 * scale, position: 'absolute', outline: `${scale}px ${color} solid`, outlineOffset: `-${0.50 * scale}px` }} />
            <div style={{ width: 2 * scale, height: 5 * scale, left: 3 * scale, top: 2 * scale, position: 'absolute', outline: `${scale}px ${color} solid`, outlineOffset: `-${0.50 * scale}px` }} />
            <div style={{ width: 10.05 * scale, height: 8 * scale, left: 0.95 * scale, top: 3 * scale, position: 'absolute', outline: `${scale}px ${color} solid`, outlineOffset: `-${0.50 * scale}px` }} />
        </div>
    );
}

/** Pointing-up / single finger icon */
function PointingUpIcon({ color = '#A78BFA' }: { color?: string }) {
    const s = 1.33;
    return (
        <div style={{ width: 16, height: 16, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: 2.67, height: 4.67, left: 9.33, top: 2.67, position: 'absolute', outline: `${s}px ${color} solid`, outlineOffset: `-${s * 0.5}px` }} />
            <div style={{ width: 2.67, height: 5.33, left: 6.67, top: 1.33, position: 'absolute', outline: `${s}px ${color} solid`, outlineOffset: `-${s * 0.5}px` }} />
            <div style={{ width: 2.67, height: 6.67, left: 4, top: 2.67, position: 'absolute', outline: `${s}px ${color} solid`, outlineOffset: `-${s * 0.5}px` }} />
            <div style={{ width: 13.40, height: 10.67, left: 1.26, top: 4, position: 'absolute', outline: `${s}px ${color} solid`, outlineOffset: `-${s * 0.5}px` }} />
        </div>
    );
}

/** Open-palm icon (back-to-menu gesture) */
function OpenPalmIcon({ color = '#A78BFA' }: { color?: string }) {
    return <Hand size={16} color={color} strokeWidth={1.6} style={{ flexShrink: 0 }} />;
}

/** Thumbs-up icon (theme switcher gesture) */
function ThumbUpIcon({ color = '#A78BFA' }: { color?: string }) {
    return (
        <div style={{ width: 16, height: 16, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 10l4.5-7a1.5 1.5 0 0 1 2.7.9v4.6H18a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 17 20h-8a2 2 0 0 1-2-2v-8Z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

/** Gesture Guide rows. `action` links a row to the backend's final
 *  gesture action so the row can flash when that gesture fires. */
const GUIDE_ROWS: { id: string; label: string; description: string; Icon: React.FC<{ color?: string }>; action: GestureAction | null }[] = [
    { id: 'scan', label: 'SCAN', description: 'Hold item over detection zone', Icon: PointingUpIcon, action: null },
    { id: 'back', label: 'BACK', description: 'Open palm — return to recipe menu', Icon: OpenPalmIcon, action: 'BACK_TO_MENU' },
    { id: 'theme', label: 'THEME', description: 'Thumbs up — switch light/dark', Icon: ThumbUpIcon, action: 'TOGGLE_THEME' },
];

/** How long each Gesture Guide row stays highlighted while the screen is idle. */
const ATTRACT_STEP_MS = 2400;

/** Mic / sound-wave bars icon */
function MicBarsIcon({ color = '#C4B5FD' }: { color?: string }) {
    const bars = [
        { h: 8, inner: 3.53, top: 2.24 },
        { h: 14, inner: 7.26, top: 3.37 },
        { h: 10, inner: 6.32, top: 1.84 },
        { h: 16, inner: 12.16, top: 1.92 },
        { h: 8, inner: 7, top: 0.50 },
    ];
    const opacities = [0.43, 0.50, 0.59, 0.70, 0.80];
    return (
        <div style={{ height: 16, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            {bars.map((b, i) => (
                <div key={i} style={{ width: 3, height: b.h, position: 'relative' }}>
                    <div style={{ width: 3, height: b.inner, left: 0, top: b.top, position: 'absolute', opacity: opacities[i], background: color, borderRadius: 1.5 + i * 0.2 }} />
                </div>
            ))}
        </div>
    );
}

/** Arrow icon (chevron-right-like) */
function ArrowIcon({ color = '#CBD5E1' }: { color?: string }) {
    return (
        <div style={{ width: 14, height: 14, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: 3.50, height: 7, left: 5.25, top: 3.50, position: 'absolute', outline: `1.17px ${color} solid`, outlineOffset: '-0.58px' }} />
        </div>
    );
}

/** Barcode-like scanner icon for the detection zone placeholder */
function ScannerIcon({ color = '#93C5FD' }: { color?: string }) {
    return (
        <div style={{ width: 48, height: 48, position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: 8, height: 14, left: 28, top: 8, position: 'absolute', outline: `4px ${color} solid`, outlineOffset: '-2px' }} />
            <div style={{ width: 8, height: 16, left: 20, top: 4, position: 'absolute', outline: `4px ${color} solid`, outlineOffset: '-2px' }} />
            <div style={{ width: 8, height: 20, left: 12, top: 8, position: 'absolute', outline: `4px ${color} solid`, outlineOffset: '-2px' }} />
            <div style={{ width: 40.21, height: 32, left: 3.79, top: 12, position: 'absolute', outline: `4px ${color} solid`, outlineOffset: '-2px' }} />
        </div>
    );
}

/** Single ingredient row in the left panel */
function IngredientRow({ ing, checked, onToggle, palette }: { ing: Ingredient; checked: boolean; onToggle: () => void; palette: Palette }) {
    const optional = isOptional(ing);
    const dotColor = checked ? '#10B981' : optional ? palette.tagTextOptional : '#D97706';
    const tagColor = optional ? palette.tagTextOptional : palette.tagTextRequired;
    const tagText = optional ? '(OPTIONAL)' : '(REQUIRED)';
    const initial = (ing.name[0] ?? '?').toUpperCase();
    const amount = formatAmount(ing);

    return (
        <div
            onClick={onToggle}
            style={{
                // Shrinks from 56px toward 36px on short screens before the list scrolls.
                height: 56, minHeight: 36, position: 'relative',
                background: checked ? palette.rowBgChecked : palette.rowBg,
                borderRadius: 14,
                border: `0.80px ${checked ? palette.rowBorderChecked : palette.rowBorder} solid`,
                display: 'flex', alignItems: 'center',
                padding: '0 12.80px', gap: 10,
                flexShrink: 1,
                cursor: 'pointer',
                transition: 'background 0.18s ease, border-color 0.18s ease',
            }}
        >
            {/* Checkbox */}
            <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: checked ? palette.checkboxBgChecked : palette.checkboxBg,
                border: `0.80px ${checked ? palette.checkboxBorderChecked : palette.checkboxBorder} solid`,
                transition: 'background 0.18s ease, border-color 0.18s ease',
            }}>
                {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>

            {/* Avatar */}
            <div style={{
                width: 28, height: 28,
                background: checked ? palette.avatarBgChecked : palette.avatarBg,
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.18s ease',
            }}>
                <span style={{ color: checked ? palette.avatarTextChecked : palette.avatarText, fontSize: 9.60, fontFamily: 'Inter, sans-serif', fontWeight: 700, lineHeight: '14.40px' }}>
                    {initial}
                </span>
            </div>

            {/* Text block */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{
                    color: checked ? palette.nameTextChecked : palette.nameText,
                    fontSize: 13.60, fontFamily: 'Inter, sans-serif',
                    fontWeight: 700, textTransform: 'uppercase', lineHeight: '20.40px',
                    letterSpacing: 0.54, overflow: 'hidden', whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    textDecoration: checked ? 'line-through' : 'none',
                    opacity: checked ? 0.65 : 1,
                }}>
                    {ing.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: tagColor, fontSize: 10.40, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '15.60px', whiteSpace: 'nowrap' }}>
                        {tagText}
                    </span>
                    {amount && (
                        <span style={{ color: palette.amountText, fontSize: 10.40, fontFamily: "'Cousine', 'Courier New', monospace", fontWeight: 400, lineHeight: '15.60px' }}>
                            {amount}
                        </span>
                    )}
                </div>
            </div>

            {/* Status dot */}
            <div style={{ width: 4.86, height: 4.86, background: dotColor, borderRadius: 2.43, opacity: 0.56, flexShrink: 0, transition: 'background 0.18s ease' }} />
        </div>
    );
}

/** Single utensil chip in the left panel (wraps, so utensils fit in 1–2 lines) */
function UtensilChip({ name, optional = false, palette }: { name: string; optional?: boolean; palette: Palette }) {
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', background: palette.utensilBg,
            borderRadius: 999, border: `0.80px ${palette.utensilBorder} solid`,
        }}>
            <div style={{ width: 6, height: 6, background: palette.utensilDot, borderRadius: 3, flexShrink: 0 }} />
            <span style={{ color: palette.utensilText, fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '18px', whiteSpace: 'nowrap' }}>
                {name}
            </span>
            {optional && (
                <span style={{ color: palette.utensilMetaText, fontSize: 9.60, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '14.40px', whiteSpace: 'nowrap' }}>
                    (optional)
                </span>
            )}
        </div>
    );
}

/* ── Main component ─────────────────────────────────────────────────── */
export const IngredientCheck: React.FC<IngredientCheckProps> = ({
    recipe,
    isConnected,
    lastAction,
    onReady,
    onBack,
    theme,
    onToggleTheme,
    voiceState,
    voiceCommand,
}) => {
    const [scanState, setScanState] = useState<ScanState>('EMPTY');
    const [checkedSet, setCheckedSet] = useState<Set<number>>(new Set());
    const palette = PALETTES[theme];

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

    const ingredients = recipe.ingredients;
    const requiredCount = ingredients.filter(i => !isOptional(i)).length;
    const matchedCount = [...checkedSet].filter(i => !isOptional(ingredients[i]!)).length;
    const itemsRemaining = requiredCount - matchedCount;

    const toggleIngredient = (index: number) => {
        setCheckedSet(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    };

    const gestureText = lastAction && lastAction !== 'NO_ACTION'
        ? `LAST GESTURE: ${lastAction.replace(/_/g, ' ')}`
        : 'LAST GESTURE: WAITING';

    /* Shared text styles */
    const sectionLabel: React.CSSProperties = {
        color: palette.sectionLabel,
        fontSize: 10.56,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        textTransform: 'uppercase',
        lineHeight: '15.84px',
        letterSpacing: 3.17,
    };

    return (
        /* ── Outer shell ──────────────────────────────────────────── */
        <div
            onPointerMove={markActivity}
            onPointerDown={markActivity}
            style={{ width: '100%', height: '100%', background: palette.shellBg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >

            {/* Content wrapper */}
            <div style={{ flex: 1, minHeight: 0, padding: 16.34, display: 'flex', flexDirection: 'column' }}>

                {/* ── Card ──────────────────────────────────────────── */}
                <div style={{
                    flex: 1, minHeight: 0,
                    padding: 17.51,
                    background: palette.cardBg,
                    overflow: 'hidden',
                    borderRadius: 36,
                    border: `0.80px ${palette.cardBorder} solid`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9.60,
                    position: 'relative',
                }}>

                    {/* Shared surface — morphs in from the selected menu card */}
                    <motion.div
                        layoutId={sharedLayoutIds.surface(recipe.id)}
                        style={{
                            position: 'absolute', inset: 0,
                            borderRadius: 36,
                            background: palette.cardBg,
                            pointerEvents: 'none',
                            zIndex: 0,
                        }}
                    />

                    {/* ── HEADER SECTION ──────────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1, flexShrink: 0 }}>

                        {/* Row 1: Status pills */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            {/* WEBSOCKET CONNECTED */}
                            <div style={{
                                height: 33.60, paddingLeft: 12, paddingRight: 12,
                                background: palette.pillBg, borderRadius: 10,
                                border: `0.80px ${palette.pillBorderWs} solid`,
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <WifiIcon color={palette.wifiIcon} />
                                <div style={{ width: 9, height: 9, background: isConnected ? '#10B981' : '#FF3D5A', borderRadius: 4.50, flexShrink: 0 }} />
                                <span style={{ color: palette.pillText, fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 1.12, whiteSpace: 'nowrap' }}>
                                    WEBSOCKET {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                                </span>
                            </div>

                            {/* LAST GESTURE */}
                            <div style={{
                                height: 33.60, paddingLeft: 12, paddingRight: 12,
                                background: palette.pillBg, borderRadius: 10,
                                border: `0.80px ${palette.pillBorderGesture} solid`,
                                display: 'flex', alignItems: 'center', gap: 8,
                                flex: 1, minWidth: 0,
                            }}>
                                <GestureIcon color={palette.gestureIcon} />
                                <div style={{ width: 9, height: 9, background: palette.gestureIcon, borderRadius: 4.50, flexShrink: 0 }} />
                                <span style={{ color: palette.pillText, fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 1.12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {gestureText}
                                </span>
                            </div>

                            {/* Voice mic status + last heard phrase */}
                            <VoiceStatusIndicator
                                state={voiceState}
                                command={voiceCommand}
                                height={33.60}
                                colors={{ bg: palette.pillBg, border: palette.pillBorderWs, text: palette.pillText, accent: palette.voiceText }}
                            />

                            {/* Theme switcher */}
                            <ThemeSwitcher theme={theme} onToggle={onToggleTheme} palette={palette} />
                        </div>

                        {/* Row 2: Scan state tabs (full-bleed) */}
                        <div style={{
                            position: 'relative',
                            left: -17.51,
                            width: 'calc(100% + 35.02px)',
                            paddingTop: 12,
                            paddingBottom: 12,
                            borderBottom: `0.80px ${palette.cardBorder} solid`,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            {SCAN_STATES.map((state) => {
                                const active = scanState === state;
                                return (
                                    <button
                                        key={state}
                                        onClick={() => setScanState(state)}
                                        style={{
                                            paddingLeft: 14, paddingRight: 14,
                                            paddingTop: 4, paddingBottom: 4,
                                            background: active ? palette.tabBgActive : palette.tabBgInactive,
                                            borderRadius: 999,
                                            border: `0.80px ${active ? palette.tabBorderActive : palette.tabBorderInactive} solid`,
                                            cursor: 'pointer',
                                            display: 'flex',
                                        }}>
                                        <span style={{
                                            color: active ? palette.tabTextActive : palette.tabTextInactive,
                                            fontSize: 9.60,
                                            fontFamily: 'Inter, sans-serif',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            lineHeight: '14.40px',
                                            letterSpacing: 1.15,
                                        }}>{state}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Row 3: Progress */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ color: palette.sectionLabel, fontSize: 10.56, fontFamily: 'Inter, sans-serif', fontWeight: 400, textTransform: 'uppercase', lineHeight: '15.84px', letterSpacing: 3.17, whiteSpace: 'nowrap' }}>
                                PROGRESS
                            </span>
                            <div style={{ flex: 1, height: 8, background: palette.progressTrack, borderRadius: 999, overflow: 'hidden', minWidth: 1 }}>
                                <motion.div
                                    style={{ height: '100%', background: palette.progressFill, borderRadius: 999 }}
                                    initial={{ width: 0 }}
                                    animate={{ width: requiredCount > 0 ? `${(matchedCount / requiredCount) * 100}%` : '0%' }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                            <span style={{ color: palette.progressFill, fontSize: 13.60, fontFamily: "'Cousine', 'Courier New', monospace", fontWeight: 700, lineHeight: '20.40px', whiteSpace: 'nowrap' }}>
                                {matchedCount}/{requiredCount}
                            </span>
                        </div>

                        {/* Row 4: Divider */}
                        <div style={{ height: 1, background: palette.cardBorder }} />
                    </div>

                    {/* ── RECIPE TITLE ROW ────────────────────────── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                        <span style={{
                            color: palette.titleText,
                            fontSize: 19.20,
                            fontFamily: "'Instrument Sans', Inter, sans-serif",
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            lineHeight: '28.80px',
                            letterSpacing: 0.58,
                        }}>
                            <motion.span
                                layoutId={sharedLayoutIds.title(recipe.id)}
                                layout="position"
                                style={{ display: 'inline-block' }}
                            >
                                {recipe.title.toUpperCase()}
                            </motion.span>
                            {' — INGREDIENT CHECK'}
                        </span>

                        {/* Required badge */}
                        <div style={{
                            paddingLeft: 14, paddingRight: 14, paddingTop: 5, paddingBottom: 5,
                            background: palette.badgeBg, borderRadius: 999,
                            border: `0.80px ${palette.badgeBorder} solid`,
                            display: 'flex', alignItems: 'center', gap: 8,
                            flexShrink: 0,
                        }}>
                            <span style={{
                                color: palette.badgeText,
                                fontSize: 13.60,
                                fontFamily: "'Dangrek', Inter, sans-serif",
                                fontWeight: 400,
                                lineHeight: '20.40px',
                                letterSpacing: 0.68,
                                whiteSpace: 'nowrap',
                            }}>
                                {matchedCount}/{requiredCount} REQUIRED
                            </span>
                            <div style={{ width: 6.82, height: 6.82, background: palette.badgeText, borderRadius: 3.41, opacity: 0.66 }} />
                        </div>
                    </div>

                    {/* ── MAIN 3-COLUMN CONTENT ───────────────────── */}
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, overflow: 'hidden', position: 'relative', zIndex: 1 }}>

                        {/* ──── LEFT: INGREDIENTS + UTENSILS ───────── */}
                        <div style={{
                            width: 256, flexShrink: 0,
                            background: palette.leftPanelBg,
                            borderRadius: 24,
                            border: `0.80px ${palette.leftPanelBorder} solid`,
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}>
                            {/* INGREDIENTS label */}
                            <div style={{ ...sectionLabel, marginBottom: 10, flexShrink: 0 }}>INGREDIENTS</div>

                            {/* Ingredient list — rows shrink first, then the list scrolls */}
                            <div style={{
                                flex: '0 1 auto', minHeight: 0,
                                overflowY: 'auto',
                                scrollbarWidth: 'thin',
                                scrollbarColor: `${palette.cardBorder} transparent`,
                                display: 'flex', flexDirection: 'column', gap: 6,
                            }}>
                                {ingredients.map((ing, i) => (
                                    <IngredientRow
                                        key={i}
                                        ing={ing}
                                        checked={checkedSet.has(i)}
                                        onToggle={() => toggleIngredient(i)}
                                        palette={palette}
                                    />
                                ))}
                            </div>

                            {/* Utensils — always visible below the list */}
                            <div style={{ flexShrink: 0, marginTop: 12 }}>
                                <div style={{ ...sectionLabel, marginBottom: 6 }}>UTENSILS</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    <UtensilChip name="Wok" palette={palette} />
                                    <UtensilChip name="Spatula" palette={palette} />
                                    <UtensilChip name="Cutting Board" optional palette={palette} />
                                </div>
                            </div>
                        </div>

                        {/* ──── CENTER: CAMERA / DETECTION ZONE ────── */}
                        <div style={{
                            flex: 1, minWidth: 0,
                            background: palette.centerPanelBg,
                            borderRadius: 20,
                            border: `0.80px ${palette.centerPanelBorder} solid`,
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                        }}>
                            {/* Camera zone */}
                            <div style={{
                                flex: 1, minHeight: 0,
                                position: 'relative',
                                background: palette.cameraZoneBg,
                                overflow: 'hidden',
                                borderRadius: 16,
                                border: `1.60px ${palette.cameraZoneBorder} solid`,
                            }}>
                                {/* Subtle gradient tint */}
                                <div style={{ position: 'absolute', inset: 0, background: palette.gradientTint, borderRadius: 16 }} />

                                {/* Corner brackets + idle / detection / gesture animation */}
                                <ScanZoneAmbient
                                    isIdle={isIdle}
                                    isDetecting={isDetecting}
                                    gesturePulse={gesturePulse}
                                    bracketColor={palette.cornerBracket}
                                    beamRgb={palette.beamRgb}
                                    particleColors={[palette.particleA, palette.particleB]}
                                />

                                {/* EMPTY STATE: Scan placeholder (replaced by camera feed later) */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    paddingLeft: 32, paddingRight: 32,
                                    gap: 0,
                                }}>
                                    <motion.div
                                        style={{ marginBottom: 16 }}
                                        animate={ambient ? { y: [0, -6, 0] } : { y: 0 }}
                                        transition={ambient ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                                    >
                                        <ScannerIcon color={palette.scannerIcon} />
                                    </motion.div>
                                    <motion.div
                                        style={{ marginBottom: 8, textAlign: 'center' }}
                                        animate={ambient ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                                        transition={ambient ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                                    >
                                        <span style={{
                                            color: palette.placeholderTitleText, fontSize: 16,
                                            fontFamily: 'Inter, sans-serif', fontWeight: 500,
                                            textTransform: 'uppercase', lineHeight: '24px',
                                            letterSpacing: 2.40,
                                        }}>
                                            PLACE INGREDIENTS TO SCAN
                                        </span>
                                    </motion.div>
                                    <span style={{
                                        color: palette.placeholderSubText, fontSize: 12,
                                        fontFamily: 'Inter, sans-serif', fontWeight: 400,
                                        lineHeight: '18px', textAlign: 'center',
                                    }}>
                                        Hold each item above the detection area
                                    </span>
                                </div>
                            </div>

                            {/* ── START COOKING button — prominent CTA ── */}
                            <button
                                onClick={onReady}
                                style={{
                                    marginTop: 12, flexShrink: 0,
                                    width: '100%', padding: '13px 0',
                                    background: itemsRemaining === 0 ? '#059669' : '#0284C7',
                                    border: 'none', borderRadius: 14,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                    transition: 'background 0.2s ease',
                                }}
                            >
                                <span style={{
                                    color: 'white', fontSize: 13,
                                    fontFamily: 'Inter, sans-serif', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: 2,
                                }}>
                                    {itemsRemaining === 0
                                        ? '✓ ALL CHECKED — START COOKING'
                                        : `START COOKING  (${matchedCount}/${requiredCount} checked)`}
                                </span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>

                        {/* ──── RIGHT: DETECTED ITEMS + GESTURE GUIDE ─ *
                         * The guide never shrinks; detected-item rows give up
                         * height first, and the column scrolls only as a last resort.
                         * ─────────────────────────────────────────────── */}
                        <div style={{
                            // 312px keeps the guide title + badge and each gesture row on one line.
                            width: 312, flexShrink: 0, minHeight: 0,
                            display: 'flex', flexDirection: 'column', gap: 12,
                            overflowY: 'auto',
                            scrollbarWidth: 'thin',
                            scrollbarColor: `${palette.cardBorder} transparent`,
                        }}>

                            {/* DETECTED ITEMS panel */}
                            <div style={{
                                background: palette.detectedPanelBg,
                                borderRadius: 24,
                                border: `0.80px ${palette.detectedPanelBorder} solid`,
                                padding: 16,
                                display: 'flex',
                                flexDirection: 'column',
                                flex: '0 1 auto', minHeight: 0,
                                overflow: 'hidden',
                            }}>
                                <div style={{ ...sectionLabel, marginBottom: 8, flexShrink: 0 }}>DETECTED ITEMS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 1 auto', minHeight: 0 }}>
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} style={{
                                            height: 44, minHeight: 28, flexShrink: 1,
                                            background: palette.detectedItemBg,
                                            borderRadius: 14, border: `0.80px ${palette.detectedItemBorder} solid`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {/* placeholder — YOLO will populate this */}
                                            <span style={{ color: palette.detectedItemText, fontSize: 9, fontFamily: 'Inter, sans-serif', letterSpacing: 1.5 }}>
                                                WAITING FOR DETECTION
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* GESTURE GUIDE panel */}
                            <div style={{
                                background: palette.guidePanelBg,
                                borderRadius: 20,
                                border: `0.80px ${palette.guidePanelBorder} solid`,
                                padding: 16,
                                display: 'flex',
                                flexDirection: 'column',
                                flex: '1 0 auto',
                            }}>
                                {/* Header row — the badge wraps under the title when the panel is narrow */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8, rowGap: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <GestureIcon color={palette.guideHeaderText} size={16} />
                                        <span style={{
                                            color: palette.guideHeaderText, fontSize: 11.20, fontFamily: 'Inter, sans-serif',
                                            fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 1.68,
                                            whiteSpace: 'nowrap',
                                        }}>GESTURE GUIDE</span>
                                    </div>
                                    {/* INGREDIENT CHECK badge */}
                                    <div style={{
                                        background: palette.guideBadgeBg, borderRadius: 999,
                                        border: `0.80px ${palette.guideBadgeBorder} solid`,
                                        padding: '4px 8.80px',
                                        display: 'flex', alignItems: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <span style={{
                                            color: palette.guideBadgeText, fontSize: 8.80, fontFamily: 'Inter, sans-serif',
                                            fontWeight: 700, textTransform: 'uppercase', lineHeight: '13.20px', letterSpacing: 0.88,
                                            whiteSpace: 'nowrap',
                                        }}>INGREDIENT CHECK</span>
                                    </div>
                                </div>

                                {/* Gesture rows — idle highlight cycles; a row flashes when its gesture fires */}
                                <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column' }}>
                                    {GUIDE_ROWS.map((row, i) => (
                                        <Fragment key={row.id}>
                                            {i > 0 && <div style={{ height: 1, background: palette.guideDivider, margin: '4px 0' }} />}
                                            <motion.div
                                                animate={{ backgroundColor: isIdle && attractIndex === i ? palette.guideRowHighlight : palette.guideRowRest }}
                                                transition={{ duration: 0.4 }}
                                                style={{
                                                    position: 'relative', isolation: 'isolate',
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '4px 8px', borderRadius: 8,
                                                }}
                                            >
                                                {row.action !== null && row.action === lastGesture && gesturePulse > 0 && (
                                                    <motion.div
                                                        key={gesturePulse}
                                                        initial={{ opacity: 1 }}
                                                        animate={{ opacity: 0 }}
                                                        transition={{ duration: 1.2, ease: 'easeOut' }}
                                                        style={{ position: 'absolute', inset: 0, zIndex: -1, borderRadius: 8, background: palette.guideRowFlash }}
                                                    />
                                                )}
                                                <div style={{ width: 20, display: 'flex', alignItems: 'center' }}>
                                                    <row.Icon color={palette.pointingIcon} />
                                                </div>
                                                <span style={{ color: palette.guideRowLabel, fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 0.67, width: 46, flexShrink: 0 }}>{row.label}</span>
                                                <span style={{ color: palette.guideRowDesc, fontSize: 10.40, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '15.60px' }}>{row.description}</span>
                                            </motion.div>
                                        </Fragment>
                                    ))}
                                </div>

                                {/* Voice confirm row — live only while the mic is listening */}
                                <div style={{
                                    paddingTop: 8, marginBottom: 10, display: 'flex', flexDirection: 'column',
                                    opacity: voiceState === 'listening' ? 1 : 0.45, transition: 'opacity 0.3s ease',
                                }}>
                                    <div style={{ paddingTop: 8, borderTop: `0.80px ${palette.voiceBorderTop} solid`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {/* Mic icon */}
                                            <div style={{ width: 14, height: 14, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                                                <div style={{ width: 3.50, height: 7.58, left: 5.25, top: 1.17, position: 'absolute', outline: `1.17px ${palette.voiceText} solid`, outlineOffset: '-0.58px' }} />
                                                <div style={{ width: 8.17, height: 5.25, left: 2.92, top: 5.83, position: 'absolute', outline: `1.17px ${palette.voiceText} solid`, outlineOffset: '-0.58px' }} />
                                            </div>
                                            <span style={{ color: palette.voiceText, fontSize: 10.40, fontFamily: 'Inter, sans-serif', fontWeight: 500, lineHeight: '15.60px', letterSpacing: 0.52 }}>
                                                SAY &quot;READY&quot; TO CONFIRM
                                            </span>
                                        </div>
                                        <motion.div
                                            animate={voiceState === 'listening' && !reduced ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
                                            transition={voiceState === 'listening' && !reduced ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                                        >
                                            <MicBarsIcon color={palette.micBars} />
                                        </motion.div>
                                    </div>
                                </div>

                                {/* PROCEED button (temp — will be replaced by gesture/voice) */}
                                <button
                                    onClick={onReady}
                                    style={{
                                        marginTop: 'auto',
                                        paddingTop: 8,
                                        paddingBottom: 8,
                                        background: palette.proceedBg,
                                        border: 'none',
                                        borderRadius: 999,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <span style={{ color: palette.proceedText, fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.68 }}>
                                        START COOKING →
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── FOOTER ──────────────────────────────────── */}
                    <div style={{
                        paddingTop: 9.60,
                        borderTop: `0.80px ${palette.footerBorderTop} solid`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                                onClick={onBack}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                                <ArrowIcon color={palette.arrowIcon} />
                                <span style={{ color: palette.footerBackText, fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 400, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 0.90 }}>Recipe:</span>
                            </button>
                            <span style={{ color: palette.footerRecipeText, fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 500, lineHeight: '18px' }}>{recipe.title}</span>
                            <span style={{ color: palette.footerSessionText, fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '16.80px' }}>Session 2 of 3</span>
                        </div>
                        <span style={{ color: palette.footerRemainingText, fontSize: 10.40, fontFamily: "'Cousine', 'Courier New', monospace", fontWeight: 400, lineHeight: '15.60px' }}>
                            {itemsRemaining} ITEMS REMAINING
                        </span>
                    </div>

                </div>
            </div>
        </div>
    );
};
