import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const ACCENT_COLORS = ['#26d9ee', '#72ffbc', '#b348ff', '#ff9f40', '#ffd166'];
const getColor = (i: number) => ACCENT_COLORS[i % ACCENT_COLORS.length];

function getImageUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
}

function ParticleField() {
    const [particles] = useState(() =>
        Array.from({ length: 20 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 1.5 + 0.5,
            duration: Math.random() * 9 + 5,
            delay: Math.random() * 6,
            color: ['#26d9ee', '#72ffbc', '#b348ff'][i % 3],
        }))
    );
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: p.color }}
                    animate={{ opacity: [0, 0.6, 0], y: [0, -60, -110], scale: [0.5, 1, 0.2] }}
                    transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
                />
            ))}
        </div>
    );
}

function StatusBar() {
    const { isConnected } = useWebSocket();
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    const statusColor = isConnected ? '#72ffbc' : '#ff6d6d';
    return (
        <div
            className="relative z-20 flex items-center justify-between px-8 py-4 flex-shrink-0"
            style={{ borderBottom: '0.8px solid rgba(255,255,255,0.07)' }}
        >
            <div className="flex items-center gap-3">
                <motion.div
                    className="size-2 rounded-full flex-shrink-0"
                    style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs tracking-widest uppercase font-mono" style={{ color: statusColor }}>
                    WebSocket {isConnected ? 'Connected' : 'Disconnected'}
                </span>
            </div>
            <div className="flex items-center gap-5">
                <span className="text-xs tracking-widest font-mono text-white/30">
                    {time.toLocaleTimeString('en-US', { hour12: false })}
                </span>
                <div
                    className="px-4 py-1 rounded-full text-xs tracking-widest uppercase font-mono"
                    style={{ background: 'rgba(179,72,255,0.12)', border: '0.8px solid rgba(179,72,255,0.4)', color: '#b348ff' }}
                >
                    CHEF MODE
                </div>
            </div>
        </div>
    );
}

function DishImageHero({ recipe, color }: { recipe: Recipe; color: string }) {
    const imageUrl = getImageUrl(recipe.image_url);
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={recipe.id}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={recipe.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: 'center 30%' }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-[#0a0f1a]" />
                )}
                {/* Top vignette */}
                <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(180deg, rgba(3,9,8,0.72) 0%, rgba(3,9,8,0.2) 35%, transparent 55%)' }}
                />
                {/* Bottom dark fade */}
                <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                        height: '62%',
                        background: 'linear-gradient(to top, #030908 0%, #030908 30%, rgba(3,9,8,0.92) 50%, rgba(3,9,8,0.6) 68%, transparent 100%)',
                    }}
                />
                {/* Bottom blur layer */}
                <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                        height: '38%',
                        backdropFilter: 'blur(18px)',
                        WebkitBackdropFilter: 'blur(18px)',
                        maskImage: 'linear-gradient(to top, black 0%, black 40%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to top, black 0%, black 40%, transparent 100%)',
                    }}
                />
                {/* Color tint */}
                <div
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(ellipse 80% 50% at 50% 70%, ${color}08 0%, transparent 70%)` }}
                />
            </motion.div>
        </AnimatePresence>
    );
}

function DishInfo({ recipe, color, onStart }: { recipe: Recipe; color: string; onStart: () => void }) {
    const cuisine = (recipe.cuisine || 'GLOBAL').toUpperCase();
    const cookTime = recipe.cook_time_minutes ? `${recipe.cook_time_minutes} MIN` : '15 MIN';
    const difficulty = (recipe.difficulty || 'EASY').toUpperCase();

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={recipe.id}
                className="relative z-10 flex flex-col items-center text-center px-6"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
            >
                {/* Badges */}
                <div className="flex items-center gap-3 mb-5">
                    <span
                        className="px-3 py-1 rounded-full text-xs tracking-widest uppercase font-mono"
                        style={{ background: `${color}18`, border: `0.8px solid ${color}50`, color }}
                    >
                        {cuisine}
                    </span>
                    <span
                        className="px-3 py-1 rounded-full text-xs tracking-widest uppercase font-mono"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '0.8px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}
                    >
                        {cookTime}
                    </span>
                    <span
                        className="px-3 py-1 rounded-full text-xs tracking-widest uppercase font-mono"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '0.8px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}
                    >
                        {difficulty}
                    </span>
                </div>

                {/* Title */}
                <h2
                    className="mb-4 tracking-widest uppercase"
                    style={{ fontFamily: "'Sometype Mono', monospace", fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', color: '#ffffff', lineHeight: 1.1 }}
                >
                    {recipe.title}
                </h2>

                {/* Description */}
                {recipe.description && (
                    <p
                        className="mb-6 max-w-xl text-sm font-mono"
                        style={{ color: 'rgba(255,255,255,0.52)', lineHeight: 1.85, letterSpacing: '0.04em' }}
                    >
                        {recipe.description}
                    </p>
                )}

                {/* Ingredients */}
                {recipe.ingredients.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-2xl">
                        {recipe.ingredients.map((ing, i) => (
                            <motion.span
                                key={ing.name}
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="px-3 py-1 rounded-full text-xs tracking-wide font-mono"
                                style={{ background: 'rgba(0,0,0,0.5)', border: `0.8px solid ${color}30`, color, opacity: 0.8 }}
                            >
                                {ing.name}
                            </motion.span>
                        ))}
                    </div>
                )}

                {/* CTA */}
                <motion.button
                    onClick={onStart}
                    className="relative px-10 py-4 rounded-full overflow-hidden cursor-pointer"
                    style={{
                        fontFamily: "'Sometype Mono', monospace",
                        fontSize: 12,
                        letterSpacing: '0.22em',
                        background: `linear-gradient(135deg, ${color}22 0%, ${color}0c 100%)`,
                        border: `0.8px solid ${color}`,
                        color,
                        boxShadow: `0 0 28px ${color}28, inset 0 0 20px ${color}08`,
                    }}
                    whileHover={{ scale: 1.04, boxShadow: `0 0 40px ${color}40` }}
                    whileTap={{ scale: 0.97 }}
                >
                    <motion.div
                        className="absolute inset-0 pointer-events-none"
                        animate={{ opacity: [0.2, 0.5, 0.2] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ background: `radial-gradient(ellipse at center, ${color}14 0%, transparent 70%)` }}
                    />
                    <span className="relative uppercase tracking-widest font-mono">INITIALIZE DETECTION →</span>
                </motion.button>
            </motion.div>
        </AnimatePresence>
    );
}

export const RecipeMenu: React.FC<RecipeMenuProps> = ({
    recipes,
    selectedIndex,
    isLoading,
    error,
    onSelect,
}) => {
    const [localHighlightIndex, setLocalHighlightIndex] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState('ALL');
    const prevSelectedIndex = useRef(selectedIndex);

    // Sync gesture-driven selectedIndex changes (MENU_NEXT / MENU_PREVIOUS) to local highlight
    useEffect(() => {
        if (prevSelectedIndex.current !== selectedIndex) {
            prevSelectedIndex.current = selectedIndex;
            setLocalHighlightIndex(selectedIndex);
        }
    }, [selectedIndex]);

    const highlightedRecipe = localHighlightIndex !== null ? (recipes[localHighlightIndex] ?? null) : null;
    const highlightedColor = localHighlightIndex !== null ? getColor(localHighlightIndex) : '#26d9ee';

    const categories = ['ALL', ...Array.from(new Set(recipes.map((r) => (r.cuisine || 'GLOBAL').toUpperCase())))];
    const filtered = activeCategory === 'ALL'
        ? recipes
        : recipes.filter((r) => (r.cuisine || 'GLOBAL').toUpperCase() === activeCategory);

    const handleStart = useCallback(() => {
        if (localHighlightIndex !== null) {
            onSelect(localHighlightIndex);
        }
    }, [localHighlightIndex, onSelect]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full w-full" style={{ background: '#030908' }}>
                <motion.p
                    className="text-xs font-mono tracking-widest"
                    style={{ color: '#26d9ee' }}
                    animate={{ opacity: [0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    LOADING RECIPES...
                </motion.p>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col overflow-hidden w-full h-full" style={{ background: '#030908' }}>
            <ParticleField />

            {/* Background image or ambient glow */}
            <div className="absolute inset-0">
                {highlightedRecipe ? (
                    <DishImageHero recipe={highlightedRecipe} color={highlightedColor} />
                ) : (
                    <motion.div
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 20%, rgba(38,217,238,0.05) 0%, transparent 70%)' }}
                    />
                )}
            </div>

            <StatusBar />

            <div className="relative z-10 flex flex-col flex-1 min-h-0">
                {/* Hero / scanner area */}
                <div className="flex flex-col items-center pt-8 pb-6 px-6">
                    <AnimatePresence mode="wait">
                        {!highlightedRecipe ? (
                            <motion.div
                                key="scanner"
                                className="flex flex-col items-center gap-5"
                                initial={{ opacity: 0, y: -12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                transition={{ duration: 0.4 }}
                            >
                                {/* Scanner ring */}
                                <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
                                    <motion.div
                                        className="absolute rounded-full border-2"
                                        style={{ width: 140, height: 140, borderColor: '#26d9ee', opacity: 0.12 }}
                                        animate={{ scale: [1, 1.1, 1], opacity: [0.12, 0.03, 0.12] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                    />
                                    <motion.div
                                        className="absolute rounded-full border"
                                        style={{ width: 116, height: 116, borderColor: '#26d9ee', opacity: 0.35, borderStyle: 'dashed' }}
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                                    />
                                    <motion.div
                                        className="absolute rounded-full border-2"
                                        style={{ width: 91, height: 91, borderColor: '#26d9ee', opacity: 0.55 }}
                                        animate={{ rotate: -360 }}
                                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <div
                                            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full"
                                            style={{ background: '#26d9ee', boxShadow: '0 0 8px #26d9ee' }}
                                        />
                                    </motion.div>
                                    <div
                                        className="relative size-12 rounded-full flex items-center justify-center"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(38,217,238,0.2) 0%, rgba(38,217,238,0.06) 100%)',
                                            border: '1px solid rgba(38,217,238,0.3)',
                                        }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 80 80" fill="none">
                                            <path d="M27 40C27 32.82 32.82 27 40 27" stroke="#26d9ee" strokeWidth="6" strokeLinecap="round" />
                                            <path d="M53 40C53 47.18 47.18 53 40 53" stroke="#26d9ee" strokeWidth="6" strokeLinecap="round" />
                                            <path d="M40 20V14M40 66V60M20 40H14M66 40H60" stroke="#26d9ee" strokeWidth="6" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-xs tracking-widest mb-2 font-mono" style={{ color: '#26d9ee', opacity: 0.5 }}>
                                        INTERACTIVE COOKING SYSTEM v2.4
                                    </div>
                                    <h1
                                        style={{ fontFamily: "'Sometype Mono', monospace", fontSize: 'clamp(2rem, 4.5vw, 3rem)', color: '#ffffff', letterSpacing: '0.25em', lineHeight: 1 }}
                                    >
                                        CHEF_HUD
                                    </h1>
                                    <p className="mt-3 text-xs tracking-widest font-mono text-white/30 max-w-[380px] leading-relaxed mx-auto">
                                        SELECT A RECIPE TO INITIALIZE INGREDIENT DETECTION
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="spacer" className="h-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
                        )}
                    </AnimatePresence>
                </div>

                {/* Dish info — sits above bottom nav */}
                <div className="flex-1 flex flex-col justify-end min-h-0">
                    {highlightedRecipe && (
                        <div className="flex flex-col items-center pb-6 overflow-y-auto">
                            <DishInfo recipe={highlightedRecipe} color={highlightedColor} onStart={handleStart} />
                        </div>
                    )}
                </div>

                {/* Bottom navigation */}
                <div className="relative z-20 px-6 pb-8 pt-4 flex-shrink-0">
                    {error && (
                        <p className="text-center text-xs font-mono text-rose-400 mb-3 tracking-widest">{error}</p>
                    )}

                    {/* Category tabs */}
                    <div
                        className="flex items-center justify-center gap-2 mb-4 overflow-x-auto"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {categories.map((cat) => (
                            <motion.button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className="px-4 py-1.5 rounded-full text-xs tracking-widest whitespace-nowrap font-mono cursor-pointer"
                                style={{
                                    background: activeCategory === cat ? 'rgba(38,217,238,0.12)' : 'rgba(0,0,0,0.45)',
                                    border: `0.8px solid ${activeCategory === cat ? 'rgba(38,217,238,0.5)' : 'rgba(255,255,255,0.09)'}`,
                                    color: activeCategory === cat ? '#26d9ee' : 'rgba(255,255,255,0.35)',
                                    backdropFilter: 'blur(8px)',
                                }}
                                whileHover={{ scale: 1.06 }}
                                whileTap={{ scale: 0.94 }}
                            >
                                {cat}
                            </motion.button>
                        ))}
                    </div>

                    {/* Recipe pills */}
                    <div
                        className="flex items-center gap-2.5 overflow-x-auto pb-1 justify-center flex-wrap"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        <AnimatePresence>
                            {filtered.map((recipe) => {
                                const recipeIndex = recipes.findIndex((r) => r.id === recipe.id);
                                const isActive = localHighlightIndex === recipeIndex;
                                const pillColor = getColor(recipeIndex);
                                return (
                                    <motion.button
                                        key={recipe.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 6 }}
                                        onClick={() => setLocalHighlightIndex(isActive ? null : recipeIndex)}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap font-mono cursor-pointer"
                                        style={{
                                            fontSize: 10,
                                            letterSpacing: '0.15em',
                                            background: isActive ? `${pillColor}20` : 'rgba(0,0,0,0.55)',
                                            border: `0.8px solid ${isActive ? pillColor : 'rgba(255,255,255,0.1)'}`,
                                            color: isActive ? pillColor : 'rgba(255,255,255,0.45)',
                                            boxShadow: isActive ? `0 0 16px ${pillColor}28` : 'none',
                                            backdropFilter: 'blur(10px)',
                                            WebkitBackdropFilter: 'blur(10px)',
                                            transition: 'box-shadow 0.3s, border-color 0.3s, background 0.3s',
                                        }}
                                        whileHover={{ scale: 1.06, transition: { duration: 0.15 } }}
                                        whileTap={{ scale: 0.93 }}
                                    >
                                        <motion.span
                                            className="size-1.5 rounded-full flex-shrink-0"
                                            style={{ background: isActive ? pillColor : 'rgba(255,255,255,0.2)' }}
                                            animate={isActive ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                                            transition={{ duration: 1.4, repeat: Infinity }}
                                        />
                                        {recipe.title.toUpperCase()}
                                    </motion.button>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};
