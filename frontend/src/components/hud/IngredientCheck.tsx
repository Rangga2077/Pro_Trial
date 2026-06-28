import { motion } from 'framer-motion';
import { useState } from 'react';
import type { GestureAction, Ingredient, Recipe } from '../../types/contracts';

export type ScanState = 'EMPTY' | 'DETECTING' | 'MATCHED' | 'WRONG ITEM' | 'READY';
const SCAN_STATES: ScanState[] = ['EMPTY', 'DETECTING', 'MATCHED', 'WRONG ITEM', 'READY'];

export interface IngredientCheckProps {
    recipe: Recipe;
    isConnected: boolean;
    lastAction: GestureAction | null;
    onReady: () => void;
    onBack: () => void;
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
function WifiIcon() {
    return (
        <div style={{ width: 12, height: 12, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: 10, height: 1.91, left: 1, top: 2.50, position: 'absolute', outline: '1px #0284C7 solid', outlineOffset: '-0.50px' }} />
            <div style={{ width: 7, height: 1.43, left: 2.50, top: 5, position: 'absolute', outline: '1px #0284C7 solid', outlineOffset: '-0.50px' }} />
            <div style={{ width: 3.50, height: 0.71, left: 4.25, top: 7.50, position: 'absolute', outline: '1px #0284C7 solid', outlineOffset: '-0.50px' }} />
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

/** Single-finger "back" icon */
function BackFingerIcon({ color = '#A78BFA' }: { color?: string }) {
    return (
        <div style={{ width: 16, height: 16, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: 4.67, height: 9.33, left: 3.33, top: 3.33, position: 'absolute', outline: `1.33px ${color} solid`, outlineOffset: '-0.67px' }} />
        </div>
    );
}

/** Mic / sound-wave bars icon */
function MicBarsIcon() {
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
                    <div style={{ width: 3, height: b.inner, left: 0, top: b.top, position: 'absolute', opacity: opacities[i], background: '#C4B5FD', borderRadius: 1.5 + i * 0.2 }} />
                </div>
            ))}
        </div>
    );
}

/** Arrow icon (chevron-right-like) */
function ArrowIcon() {
    return (
        <div style={{ width: 14, height: 14, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: 3.50, height: 7, left: 5.25, top: 3.50, position: 'absolute', outline: '1.17px #CBD5E1 solid', outlineOffset: '-0.58px' }} />
        </div>
    );
}

/** Barcode-like scanner icon for the detection zone placeholder */
function ScannerIcon() {
    return (
        <div style={{ width: 48, height: 48, position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: 8, height: 14, left: 28, top: 8, position: 'absolute', outline: '4px #93C5FD solid', outlineOffset: '-2px' }} />
            <div style={{ width: 8, height: 16, left: 20, top: 4, position: 'absolute', outline: '4px #93C5FD solid', outlineOffset: '-2px' }} />
            <div style={{ width: 8, height: 20, left: 12, top: 8, position: 'absolute', outline: '4px #93C5FD solid', outlineOffset: '-2px' }} />
            <div style={{ width: 40.21, height: 32, left: 3.79, top: 12, position: 'absolute', outline: '4px #93C5FD solid', outlineOffset: '-2px' }} />
        </div>
    );
}

/** Single ingredient row in the left panel */
function IngredientRow({ ing, checked, onToggle }: { ing: Ingredient; checked: boolean; onToggle: () => void }) {
    const optional = isOptional(ing);
    const dotColor = checked ? '#10B981' : optional ? '#CBD5E1' : '#D97706';
    const tagColor = optional ? '#94A3B8' : '#D97706';
    const tagText = optional ? '(OPTIONAL)' : '(REQUIRED)';
    const initial = (ing.name[0] ?? '?').toUpperCase();
    const amount = formatAmount(ing);

    return (
        <div
            onClick={onToggle}
            style={{
                height: 56, minHeight: 56, position: 'relative',
                background: checked ? '#F0FDF4' : 'white',
                borderRadius: 14,
                border: `0.80px ${checked ? '#BBF7D0' : '#E2E8F0'} solid`,
                display: 'flex', alignItems: 'center',
                padding: '0 12.80px', gap: 10,
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'background 0.18s ease, border-color 0.18s ease',
            }}
        >
            {/* Checkbox */}
            <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: checked ? '#10B981' : 'white',
                border: `0.80px ${checked ? '#10B981' : '#CBD5E1'} solid`,
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
                background: checked ? '#D1FAE5' : '#E0F2FE',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.18s ease',
            }}>
                <span style={{ color: checked ? '#059669' : '#0284C7', fontSize: 9.60, fontFamily: 'Inter, sans-serif', fontWeight: 700, lineHeight: '14.40px' }}>
                    {initial}
                </span>
            </div>

            {/* Text block */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{
                    color: checked ? '#065F46' : '#0F172A',
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
                        <span style={{ color: '#0284C7', fontSize: 10.40, fontFamily: "'Cousine', 'Courier New', monospace", fontWeight: 400, lineHeight: '15.60px' }}>
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

/** Single utensil row in the left panel */
function UtensilRow({ name, optional = false }: { name: string; optional?: boolean }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '6px 12px', background: 'white',
            borderRadius: 10, border: '0.80px #E2E8F0 solid',
        }}>
            <div style={{ width: 6, height: 6, background: '#93C5FD', borderRadius: 3, flexShrink: 0 }} />
            <span style={{ color: '#475569', fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '18px', flex: 1 }}>
                {name}
            </span>
            <span style={{ color: '#94A3B8', fontSize: 9.60, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '14.40px', whiteSpace: 'nowrap' }}>
                ({optional ? 'optional' : 'required'})
            </span>
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
}) => {
    const [scanState, setScanState] = useState<ScanState>('EMPTY');
    const [checkedSet, setCheckedSet] = useState<Set<number>>(new Set());

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
        color: '#64748B',
        fontSize: 10.56,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        textTransform: 'uppercase',
        lineHeight: '15.84px',
        letterSpacing: 3.17,
    };

    return (
        /* ── Outer shell ──────────────────────────────────────────── */
        <div style={{ width: '100%', height: '100%', background: '#F1F5F9', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Title-bar spacer (Electron frame area) */}
            <div style={{ height: 48.80, flexShrink: 0 }} />

            {/* Content wrapper */}
            <div style={{ flex: 1, minHeight: 0, padding: 16.34, display: 'flex', flexDirection: 'column' }}>

                {/* ── White card ──────────────────────────────────── */}
                <div style={{
                    flex: 1, minHeight: 0,
                    padding: 17.51,
                    background: 'white',
                    overflow: 'hidden',
                    borderRadius: 36,
                    border: '0.80px #E2E8F0 solid',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9.60,
                }}>

                    {/* ── HEADER SECTION ──────────────────────────── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', flexShrink: 0 }}>

                        {/* Row 1: Status pills */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {/* WEBSOCKET CONNECTED */}
                            <div style={{
                                height: 33.60, paddingLeft: 12, paddingRight: 12,
                                background: '#F8FAFC', borderRadius: 10,
                                border: '0.80px #CBD5E1 solid',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <WifiIcon />
                                <div style={{ width: 9, height: 9, background: isConnected ? '#10B981' : '#FF3D5A', borderRadius: 4.50, flexShrink: 0 }} />
                                <span style={{ color: '#475569', fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 1.12, whiteSpace: 'nowrap' }}>
                                    WEBSOCKET {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                                </span>
                            </div>

                            {/* LAST GESTURE */}
                            <div style={{
                                height: 33.60, paddingLeft: 12, paddingRight: 12,
                                background: '#F8FAFC', borderRadius: 10,
                                border: '0.80px #C4B5FD solid',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <GestureIcon />
                                <div style={{ width: 9, height: 9, background: '#7C3AED', borderRadius: 4.50, flexShrink: 0 }} />
                                <span style={{ color: '#475569', fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 1.12, whiteSpace: 'nowrap' }}>
                                    {gestureText}
                                </span>
                            </div>
                        </div>

                        {/* Row 2: Scan state tabs (full-bleed) */}
                        <div style={{
                            position: 'relative',
                            left: -17.51,
                            width: 'calc(100% + 35.02px)',
                            paddingTop: 12,
                            paddingBottom: 12,
                            borderBottom: '0.80px #E2E8F0 solid',
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
                                            background: active ? '#EFF6FF' : 'white',
                                            borderRadius: 999,
                                            border: `0.80px ${active ? '#0284C7' : '#CBD5E1'} solid`,
                                            cursor: 'pointer',
                                            display: 'flex',
                                        }}>
                                        <span style={{
                                            color: active ? '#0284C7' : '#64748B',
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
                            <span style={{ color: '#64748B', fontSize: 10.56, fontFamily: 'Inter, sans-serif', fontWeight: 400, textTransform: 'uppercase', lineHeight: '15.84px', letterSpacing: 3.17, whiteSpace: 'nowrap' }}>
                                PROGRESS
                            </span>
                            <div style={{ flex: 1, height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden', minWidth: 1 }}>
                                <motion.div
                                    style={{ height: '100%', background: '#0284C7', borderRadius: 999 }}
                                    initial={{ width: 0 }}
                                    animate={{ width: requiredCount > 0 ? `${(matchedCount / requiredCount) * 100}%` : '0%' }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                            <span style={{ color: '#0284C7', fontSize: 13.60, fontFamily: "'Cousine', 'Courier New', monospace", fontWeight: 700, lineHeight: '20.40px', whiteSpace: 'nowrap' }}>
                                {matchedCount}/{requiredCount}
                            </span>
                        </div>

                        {/* Row 4: Divider */}
                        <div style={{ height: 1, background: '#E2E8F0' }} />
                    </div>

                    {/* ── RECIPE TITLE ROW ────────────────────────── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{
                            color: '#1143B7',
                            fontSize: 19.20,
                            fontFamily: "'Instrument Sans', Inter, sans-serif",
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            lineHeight: '28.80px',
                            letterSpacing: 0.58,
                        }}>
                            {recipe.title.toUpperCase()} — INGREDIENT CHECK
                        </span>

                        {/* Required badge */}
                        <div style={{
                            paddingLeft: 14, paddingRight: 14, paddingTop: 5, paddingBottom: 5,
                            background: '#EFF6FF', borderRadius: 999,
                            border: '0.80px #93C5FD solid',
                            display: 'flex', alignItems: 'center', gap: 8,
                            flexShrink: 0,
                        }}>
                            <span style={{
                                color: '#0284C7',
                                fontSize: 13.60,
                                fontFamily: "'Dangrek', Inter, sans-serif",
                                fontWeight: 400,
                                lineHeight: '20.40px',
                                letterSpacing: 0.68,
                                whiteSpace: 'nowrap',
                            }}>
                                {matchedCount}/{requiredCount} REQUIRED
                            </span>
                            <div style={{ width: 6.82, height: 6.82, background: '#0284C7', borderRadius: 3.41, opacity: 0.66 }} />
                        </div>
                    </div>

                    {/* ── MAIN 3-COLUMN CONTENT ───────────────────── */}
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, overflow: 'hidden' }}>

                        {/* ──── LEFT: INGREDIENTS + UTENSILS ───────── */}
                        <div style={{
                            width: 256, flexShrink: 0,
                            background: '#FAFAFA',
                            borderRadius: 24,
                            border: '0.80px #E2E8F0 solid',
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}>
                            {/* INGREDIENTS label */}
                            <div style={{ ...sectionLabel, marginBottom: 10, flexShrink: 0 }}>INGREDIENTS</div>

                            {/* Ingredient list */}
                            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {ingredients.map((ing, i) => (
                                    <IngredientRow
                                        key={i}
                                        ing={ing}
                                        checked={checkedSet.has(i)}
                                        onToggle={() => toggleIngredient(i)}
                                    />
                                ))}

                                {/* Spacer */}
                                <div style={{ paddingTop: 6, paddingBottom: 6, flexShrink: 0 }} />

                                {/* UTENSILS label */}
                                <div style={{ ...sectionLabel, marginBottom: 2, flexShrink: 0 }}>UTENSILS</div>

                                <UtensilRow name="Wok" />
                                <UtensilRow name="Spatula" />
                                <UtensilRow name="Cutting Board" optional />
                            </div>
                        </div>

                        {/* ──── CENTER: CAMERA / DETECTION ZONE ────── */}
                        <div style={{
                            flex: 1, minWidth: 0,
                            background: '#F8FAFC',
                            borderRadius: 20,
                            border: '0.80px #E2E8F0 solid',
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                        }}>
                            {/* Camera zone */}
                            <div style={{
                                flex: 1, minHeight: 0,
                                position: 'relative',
                                background: '#F0F9FF',
                                overflow: 'hidden',
                                borderRadius: 16,
                                border: '1.60px #93C5FD solid',
                            }}>
                                {/* Corner brackets */}
                                <div style={{ width: 24, height: 24, position: 'absolute', left: 1.60, top: 1.60, borderRadius: 3, borderLeft: '1.60px #0284C7 solid', borderTop: '1.60px #0284C7 solid' }} />
                                <div style={{ width: 24, height: 24, position: 'absolute', right: 1.60, top: 1.60, borderRadius: 3, borderTop: '1.60px #0284C7 solid', borderRight: '1.60px #0284C7 solid' }} />
                                <div style={{ width: 24, height: 24, position: 'absolute', left: 1.60, bottom: 1.60, borderRadius: 3, borderLeft: '1.60px #0284C7 solid', borderBottom: '1.60px #0284C7 solid' }} />
                                <div style={{ width: 24, height: 24, position: 'absolute', right: 1.60, bottom: 1.60, borderRadius: 3, borderRight: '1.60px #0284C7 solid', borderBottom: '1.60px #0284C7 solid' }} />

                                {/* Subtle gradient tint */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,132,199,0.05) 0%, transparent 100%)', borderRadius: 16 }} />

                                {/* EMPTY STATE: Scan placeholder (replaced by camera feed later) */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    paddingLeft: 32, paddingRight: 32,
                                    gap: 0,
                                }}>
                                    <div style={{ marginBottom: 16 }}>
                                        <ScannerIcon />
                                    </div>
                                    <div style={{ marginBottom: 8, textAlign: 'center' }}>
                                        <span style={{
                                            color: '#0284C7', fontSize: 16,
                                            fontFamily: 'Inter, sans-serif', fontWeight: 500,
                                            textTransform: 'uppercase', lineHeight: '24px',
                                            letterSpacing: 2.40,
                                        }}>
                                            PLACE INGREDIENTS TO SCAN
                                        </span>
                                    </div>
                                    <span style={{
                                        color: '#94A3B8', fontSize: 12,
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

                        {/* ──── RIGHT: DETECTED ITEMS + GESTURE GUIDE ─ */}
                        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

                            {/* DETECTED ITEMS panel */}
                            <div style={{
                                background: '#FAFAFA',
                                borderRadius: 24,
                                border: '0.80px #E2E8F0 solid',
                                padding: 16,
                                display: 'flex',
                                flexDirection: 'column',
                                flexShrink: 0,
                            }}>
                                <div style={{ ...sectionLabel, marginBottom: 10 }}>DETECTED ITEMS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} style={{
                                            height: 44, background: '#FAFAFA',
                                            borderRadius: 14, border: '0.80px #E2E8F0 solid',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {/* placeholder — YOLO will populate this */}
                                            <span style={{ color: '#CBD5E1', fontSize: 9, fontFamily: 'Inter, sans-serif', letterSpacing: 1.5 }}>
                                                WAITING FOR DETECTION
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* GESTURE GUIDE panel */}
                            <div style={{
                                background: '#FAFAFF',
                                borderRadius: 20,
                                border: '0.80px #DDD6FE solid',
                                padding: 16,
                                display: 'flex',
                                flexDirection: 'column',
                                flex: 1, minHeight: 0,
                            }}>
                                {/* Header row */}
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0, height: 35 }}>
                                    <GestureIcon color="#7C3AED" size={16} />
                                    <span style={{
                                        color: '#7C3AED', fontSize: 11.20, fontFamily: 'Inter, sans-serif',
                                        fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 1.68,
                                    }}>GESTURE GUIDE</span>
                                    {/* INGREDIENT CHECK badge */}
                                    <div style={{
                                        position: 'absolute', right: 0, top: 2.83,
                                        background: '#EDE9FE', borderRadius: 999,
                                        border: '0.80px #C4B5FD solid',
                                        padding: '8px 8.80px',
                                        display: 'flex', alignItems: 'center',
                                    }}>
                                        <span style={{
                                            color: '#7C3AED', fontSize: 8.80, fontFamily: 'Inter, sans-serif',
                                            fontWeight: 700, textTransform: 'uppercase', lineHeight: '13.20px', letterSpacing: 0.88,
                                        }}>INGREDIENT CHECK</span>
                                    </div>
                                </div>

                                {/* Gesture rows */}
                                <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column' }}>
                                    {/* SCAN gesture */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8 }}>
                                        <div style={{ width: 20, display: 'flex', alignItems: 'center' }}>
                                            <PointingUpIcon />
                                        </div>
                                        <span style={{ color: '#7C3AED', fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 0.67, width: 64, flexShrink: 0 }}>SCAN</span>
                                        <span style={{ color: '#64748B', fontSize: 10.40, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '15.60px' }}>Hold item over detection zone</span>
                                    </div>

                                    {/* Divider */}
                                    <div style={{ height: 1, background: '#F1F5F9', margin: '5px 0' }} />

                                    {/* BACK gesture */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8 }}>
                                        <div style={{ width: 20, display: 'flex', alignItems: 'center' }}>
                                            <BackFingerIcon />
                                        </div>
                                        <span style={{ color: '#7C3AED', fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 0.67, width: 64, flexShrink: 0 }}>BACK</span>
                                        <span style={{ color: '#64748B', fontSize: 10.40, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '15.60px' }}>Return to recipe menu</span>
                                    </div>
                                </div>

                                {/* Voice confirm row */}
                                <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ paddingTop: 8, borderTop: '0.80px #EDE9FE solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {/* Mic icon */}
                                            <div style={{ width: 14, height: 14, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                                                <div style={{ width: 3.50, height: 7.58, left: 5.25, top: 1.17, position: 'absolute', outline: '1.17px #7C3AED solid', outlineOffset: '-0.58px' }} />
                                                <div style={{ width: 8.17, height: 5.25, left: 2.92, top: 5.83, position: 'absolute', outline: '1.17px #7C3AED solid', outlineOffset: '-0.58px' }} />
                                            </div>
                                            <span style={{ color: '#7C3AED', fontSize: 10.40, fontFamily: 'Inter, sans-serif', fontWeight: 500, lineHeight: '15.60px', letterSpacing: 0.52 }}>
                                                SAY &quot;READY&quot; TO CONFIRM
                                            </span>
                                        </div>
                                        <MicBarsIcon />
                                    </div>
                                </div>

                                {/* PROCEED button (temp — will be replaced by gesture/voice) */}
                                <button
                                    onClick={onReady}
                                    style={{
                                        marginTop: 'auto',
                                        paddingTop: 8,
                                        paddingBottom: 8,
                                        background: '#7C3AED',
                                        border: 'none',
                                        borderRadius: 999,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <span style={{ color: 'white', fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.68 }}>
                                        START COOKING →
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── FOOTER ──────────────────────────────────── */}
                    <div style={{
                        paddingTop: 9.60,
                        borderTop: '0.80px #E2E8F0 solid',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                                onClick={onBack}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                                <ArrowIcon />
                                <span style={{ color: '#94A3B8', fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 400, textTransform: 'uppercase', lineHeight: '16.80px', letterSpacing: 0.90 }}>Recipe:</span>
                            </button>
                            <span style={{ color: '#0F172A', fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 500, lineHeight: '18px' }}>{recipe.title}</span>
                            <span style={{ color: '#64748B', fontSize: 11.20, fontFamily: 'Inter, sans-serif', fontWeight: 400, lineHeight: '16.80px' }}>Session 2 of 3</span>
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: 10.40, fontFamily: "'Cousine', 'Courier New', monospace", fontWeight: 400, lineHeight: '15.60px' }}>
                            {itemsRemaining} ITEMS REMAINING
                        </span>
                    </div>

                </div>
            </div>

            {/* Decorative ambient dots (from Figma background) */}
            {[
                { left: 140.06, top: 122.69, size: 5, color: '#BAE6FD' },
                { left: 957.10, top: 163.57, size: 6, color: '#BAE6FD' },
                { left: 70.03, top: 490.75, size: 5, color: '#BAE6FD' },
                { left: 1062.15, top: 463.49, size: 5, color: '#BAE6FD' },
                { left: 525.24, top: 54.53, size: 5, color: '#DDD6FE' },
                { left: 887.06, top: 599.80, size: 6, color: '#DDD6FE' },
                { left: 256.77, top: 627.06, size: 5, color: '#DDD6FE' },
            ].map((dot, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    left: dot.left, top: dot.top,
                    width: dot.size, height: dot.size,
                    background: dot.color,
                    borderRadius: dot.size / 2,
                    opacity: 0.80,
                    pointerEvents: 'none',
                }} />
            ))}
        </div>
    );
};
