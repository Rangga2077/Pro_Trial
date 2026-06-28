import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWebSocket } from '../../context/useWebSocket';
import { API_BASE_URL } from '../../config';
import type { Recipe } from '../../types/contracts';

export interface RecipeMenuProps {
    recipes: Recipe[];
    selectedIndex: number;
    isLoading: boolean;
    error: string | null;
    onSelect: (index?: number) => void;
    onNext: () => void;
    onPrevious: () => void;
    onClose: () => void;
}

/* ── Constants ──────────────────────────────────────────────────────── */

const CARD_W = 520;
const CARD_H = 325;

/** Per-distance-from-center visual transform values */
const CARD_TRANSFORMS = [
    { x: 0,    scale: 1.00, opacity: 1.00, dimOpacity: 0,    zIndex: 20 }, // center
    { x: 340,  scale: 0.76, opacity: 0.85, dimOpacity: 0.42, zIndex: 15 }, // ±1
    { x: 575,  scale: 0.56, opacity: 0.55, dimOpacity: 0.62, zIndex: 10 }, // ±2
    { x: 730,  scale: 0.42, opacity: 0.00, dimOpacity: 0.80, zIndex: 5  }, // ±3 (hidden)
];

const CARD_GRADIENTS = [
    'linear-gradient(150deg, #0f1117 0%, #1c2848 55%, #0d1835 100%)',
    'linear-gradient(150deg, #1a0a0a 0%, #3d1515 55%, #200a0a 100%)',
    'linear-gradient(150deg, #0a1512 0%, #0f2d20 55%, #071a10 100%)',
    'linear-gradient(150deg, #120a1a 0%, #2a1045 55%, #160825 100%)',
    'linear-gradient(150deg, #14100a 0%, #2e2206 55%, #1a1400 100%)',
];

/* ── Helpers ────────────────────────────────────────────────────────── */

function getImageUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
}

function wrap(i: number, total: number): number {
    return ((i % total) + total) % total;
}

/** Shortest signed distance from index → active, accounting for wrap */
function wrappedOffset(index: number, active: number, total: number): number {
    if (total <= 1) return 0;
    const raw = index - active;
    if (raw > total / 2) return raw - total;
    if (raw < -total / 2) return raw + total;
    return raw;
}

function getTransform(offset: number) {
    const abs = Math.min(Math.abs(offset), 3);
    const dir = offset >= 0 ? 1 : -1;
    const t = CARD_TRANSFORMS[abs];
    return { ...t, x: dir * t.x };
}

/* ── Single carousel card ───────────────────────────────────────────── */

interface CarouselCardProps {
    recipe: Recipe;
    colorIndex: number;
    offset: number;
    onFocus: () => void;
    onInitialize: () => void;
}

const CarouselCard: React.FC<CarouselCardProps> = ({
    recipe, colorIndex, offset, onFocus, onInitialize,
}) => {
    const imageUrl = getImageUrl(recipe.image_url);
    const t = getTransform(offset);
    const isCenter = offset === 0;

    const cuisine  = (recipe.cuisine   || 'GLOBAL').toUpperCase();
    const diff     = (recipe.difficulty || 'EASY').toUpperCase();
    const cookTime = recipe.cook_time_minutes ? `${recipe.cook_time_minutes} MIN` : '—';

    return (
        <motion.div
            style={{
                position: 'absolute',
                width: CARD_W,
                height: CARD_H,
                left: '50%',
                top: '50%',
                marginLeft: -CARD_W / 2,
                marginTop: -CARD_H / 2,
                borderRadius: 20,
                overflow: 'hidden',
                cursor: isCenter ? 'default' : 'pointer',
            }}
            animate={{
                x: t.x,
                scale: t.scale,
                opacity: t.opacity,
                zIndex: t.zIndex,
            }}
            transition={{ duration: 0.48, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={() => { if (!isCenter) onFocus(); }}
            whileHover={!isCenter ? { scale: t.scale * 1.04 } : undefined}
        >
            {/* Background: image or colour gradient */}
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={recipe.title}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
                />
            ) : (
                <div style={{ position: 'absolute', inset: 0, background: CARD_GRADIENTS[colorIndex % CARD_GRADIENTS.length] }} />
            )}

            {/* Dark gradient overlay — heavier at bottom for text */}
            <div style={{
                position: 'absolute', inset: 0,
                background: isCenter
                    ? 'linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.55) 38%, rgba(0,0,0,0.18) 65%, transparent 100%)'
                    : 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.30) 55%, transparent 100%)',
            }} />

            {/* Dimming overlay — animated per distance */}
            <motion.div
                style={{ position: 'absolute', inset: 0, background: '#000', borderRadius: 20 }}
                animate={{ opacity: t.dimOpacity }}
                transition={{ duration: 0.48, ease: 'easeOut' }}
            />

            {/* Content (center card only) */}
            {isCenter && (
                <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    padding: '22px 26px',
                    display: 'flex', flexDirection: 'column', gap: 9,
                }}>
                    {/* Badges */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[cuisine, diff, cookTime].map((badge) => (
                            <span key={badge} style={{
                                padding: '3px 10px', borderRadius: 999,
                                border: '0.8px solid rgba(255,255,255,0.22)',
                                background: 'rgba(0,0,0,0.45)',
                                backdropFilter: 'blur(10px)',
                                color: 'rgba(255,255,255,0.62)',
                                fontSize: 9, fontFamily: 'Inter, sans-serif',
                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2,
                            }}>{badge}</span>
                        ))}
                    </div>

                    {/* Title */}
                    <h2 style={{
                        margin: 0, color: '#ffffff',
                        fontSize: 24,
                        fontFamily: "'Sometype Mono', 'Space Mono', monospace",
                        fontWeight: 700, textTransform: 'uppercase',
                        lineHeight: 1.15, letterSpacing: '0.04em',
                    }}>
                        {recipe.title}
                    </h2>

                    {/* Description */}
                    {recipe.description && (
                        <p style={{
                            margin: 0, color: 'rgba(255,255,255,0.52)',
                            fontSize: 11, fontFamily: 'Inter, sans-serif',
                            fontWeight: 400, lineHeight: 1.65,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                        }}>
                            {recipe.description}
                        </p>
                    )}

                    {/* CTA row */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 2, alignItems: 'center' }}>
                        <motion.button
                            onClick={onInitialize}
                            style={{
                                padding: '9px 20px',
                                background: 'white', border: 'none', borderRadius: 8,
                                color: '#0C0C0F', fontSize: 11,
                                fontFamily: 'Inter, sans-serif', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: 1.3,
                                cursor: 'pointer',
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.96 }}
                        >
                            START COOKING
                        </motion.button>

                        {recipe.ingredients.length > 0 && (
                            <span style={{
                                padding: '9px 16px',
                                border: '0.8px solid rgba(255,255,255,0.22)', borderRadius: 8,
                                color: 'rgba(255,255,255,0.55)',
                                fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 400, letterSpacing: 0.5,
                            }}>
                                {recipe.ingredients.length} INGREDIENTS
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Active card border glow */}
            {isCenter && (
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.14)',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.6)',
                    pointerEvents: 'none',
                }} />
            )}
        </motion.div>
    );
};

/* ── Main component ─────────────────────────────────────────────────── */

export const RecipeMenu: React.FC<RecipeMenuProps> = ({
    recipes,
    selectedIndex,
    isLoading,
    error,
    onSelect,
    onNext,
    onPrevious,
}) => {
    const { isConnected } = useWebSocket();
    const [activeIndex, setActiveIndex] = useState(selectedIndex);
    const prevGestureIndex = useRef(selectedIndex);

    /* Sync gesture-driven parent changes */
    useEffect(() => {
        if (prevGestureIndex.current !== selectedIndex) {
            prevGestureIndex.current = selectedIndex;
            setActiveIndex(selectedIndex);
        }
    }, [selectedIndex]);

    const total = recipes.length;

    const goPrev = useCallback(() => {
        if (total === 0) return;
        const next = wrap(activeIndex - 1, total);
        setActiveIndex(next);
        onPrevious();
    }, [activeIndex, total, onPrevious]);

    const goNext = useCallback(() => {
        if (total === 0) return;
        const next = wrap(activeIndex + 1, total);
        setActiveIndex(next);
        onNext();
    }, [activeIndex, total, onNext]);

    const handleInitialize = useCallback(() => {
        onSelect(activeIndex);
    }, [activeIndex, onSelect]);

    /* ── Loading ── */
    if (isLoading) {
        return (
            <div style={{
                width: '100%', height: '100%', background: '#0C0C0F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <motion.p
                    style={{
                        color: 'rgba(255,255,255,0.35)', fontSize: 11,
                        fontFamily: 'Inter, sans-serif', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 3,
                    }}
                    animate={{ opacity: [0.35, 0.85, 0.35] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                >
                    LOADING RECIPES...
                </motion.p>
            </div>
        );
    }

    /* ── Error / empty ── */
    if (error || total === 0) {
        return (
            <div style={{
                width: '100%', height: '100%', background: '#0C0C0F',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12,
            }}>
                <p style={{ color: 'rgba(255,80,80,0.75)', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
                    {error ?? 'No recipes found'}
                </p>
            </div>
        );
    }

    return (
        <div style={{
            width: '100%', height: '100%',
            background: '#0C0C0F',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Subtle centre ambient glow */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 55% 45% at 50% 55%, rgba(255,255,255,0.035) 0%, transparent 70%)',
            }} />

            {/* ── Status bar (top) ─────────────────────────── */}
            <div style={{
                position: 'absolute', top: 20, left: 0, right: 0,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0 28px', zIndex: 30, pointerEvents: 'none',
            }}>
                {/* WebSocket status chip */}
                <div style={{
                    pointerEvents: 'auto',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '7px 14px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '0.8px solid rgba(255,255,255,0.10)',
                    borderRadius: 10, backdropFilter: 'blur(12px)',
                }}>
                    <motion.div
                        style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: isConnected ? '#4DFFB3' : '#FF5A6A',
                            boxShadow: `0 0 6px ${isConnected ? '#4DFFB3' : '#FF5A6A'}`,
                        }}
                        animate={{ opacity: [1, 0.45, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span style={{
                        color: 'rgba(255,255,255,0.50)', fontSize: 10,
                        fontFamily: 'Inter, sans-serif', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 1.2,
                    }}>
                        {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                </div>

                {/* Index counter */}
                <div style={{
                    pointerEvents: 'auto',
                    padding: '7px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.8px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                }}>
                    <span style={{
                        color: 'rgba(255,255,255,0.30)', fontSize: 10,
                        fontFamily: "'Cousine', 'Courier New', monospace", fontWeight: 700,
                        letterSpacing: 1.5,
                    }}>
                        {activeIndex + 1} / {total}
                    </span>
                </div>
            </div>

            {/* ── Carousel area ────────────────────────────── */}
            <div style={{
                flex: 1, position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {/* Left chevron */}
                <motion.button
                    onClick={goPrev}
                    style={{
                        position: 'absolute', left: 18, zIndex: 30,
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.07)',
                        border: '0.8px solid rgba(255,255,255,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', backdropFilter: 'blur(12px)',
                    }}
                    whileHover={{ background: 'rgba(255,255,255,0.14)', scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                >
                    <ChevronLeft size={18} color="rgba(255,255,255,0.65)" />
                </motion.button>

                {/* Cards container */}
                <div style={{ position: 'relative', width: CARD_W, height: CARD_H }}>
                    {recipes.map((recipe, i) => {
                        const offset = wrappedOffset(i, activeIndex, total);
                        if (Math.abs(offset) >= 3) return null; // off-screen, skip render
                        return (
                            <CarouselCard
                                key={recipe.id}
                                recipe={recipe}
                                colorIndex={i}
                                offset={offset}
                                onFocus={() => setActiveIndex(i)}
                                onInitialize={handleInitialize}
                            />
                        );
                    })}
                </div>

                {/* Right chevron */}
                <motion.button
                    onClick={goNext}
                    style={{
                        position: 'absolute', right: 18, zIndex: 30,
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.07)',
                        border: '0.8px solid rgba(255,255,255,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', backdropFilter: 'blur(12px)',
                    }}
                    whileHover={{ background: 'rgba(255,255,255,0.14)', scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                >
                    <ChevronRight size={18} color="rgba(255,255,255,0.65)" />
                </motion.button>
            </div>

            {/* ── Dot indicators (bottom) ─────────────────── */}
            <div style={{
                position: 'absolute', bottom: 24, left: 0, right: 0,
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7,
                zIndex: 30,
            }}>
                {recipes.map((_, i) => (
                    <motion.button
                        key={i}
                        onClick={() => setActiveIndex(i)}
                        style={{
                            height: 6, borderRadius: 999,
                            background: 'transparent',
                            border: 'none', cursor: 'pointer', padding: 0,
                        }}
                        animate={{
                            width: i === activeIndex ? 22 : 6,
                            backgroundColor: i === activeIndex
                                ? 'rgba(255,255,255,0.80)'
                                : 'rgba(255,255,255,0.22)',
                        }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                    />
                ))}
            </div>
        </div>
    );
};
