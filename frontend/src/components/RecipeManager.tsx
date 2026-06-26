import { AnimatePresence, motion } from 'framer-motion';
import { ChefHat, CircleDot, Hand, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { useWebSocket } from '../context/useWebSocket';
import type { Recipe } from '../types/contracts';
import { useProjectionHud, type ProjectionHudMode } from '../useProjectionHud';
import FigmaCookingPanel from './FigmaCookingPanel';
import WelcomeMenu from './WelcomeMenu';

type HudIcon = ElementType<{ className?: string }>;

const cyan = '#00D3F3';
const purple = '#b447ff';

function formatMinutes(minutes?: number | null) {
    if (!minutes) return '--';
    return `${minutes} min`;
}

function formatClock(minutes?: number | null, fallback = '--:--') {
    if (!minutes) return fallback;
    return `${String(minutes).padStart(2, '0')}:00`;
}

function modeLabel(mode: ProjectionHudMode) {
    if (mode === 'menu') return 'MENU';
    if (mode === 'cooking') return 'ACTIVE';
    return 'STANDBY';
}

function actionLabel(action: string | null) {
    if (!action || action === 'NO_ACTION') return 'WAITING';
    return action.replaceAll('_', ' / ');
}

/* ── Decorative scatter dots (matches Figma absolute-positioned dot elements) ── */
function ScatterDots() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {/* Cyan dots */}
            <div className="absolute left-[20.5%] top-[10.7%] h-[3px] w-[3px] rounded-full bg-[#3EF7FF] opacity-60" />
            <div className="absolute left-[40%] top-[3.5%] h-[2.5px] w-[2.5px] rounded-full bg-[#3EF7FF] opacity-50" />
            <div className="absolute bottom-[9%] left-[60%] h-[3px] w-[3px] rounded-full bg-[#3EF7FF] opacity-55" />
            <div className="absolute bottom-[3%] right-[24%] h-[2.5px] w-[2.5px] rounded-full bg-[#3EF7FF] opacity-45" />
            {/* Purple dots */}
            <div className="absolute right-[9%] top-[14%] h-[3px] w-[3px] rounded-full bg-[#B447FF] opacity-55" />
            <div className="absolute bottom-[56%] left-[3%] h-[2.5px] w-[2.5px] rounded-full bg-[#B447FF] opacity-45" />
            <div className="absolute right-[3%] top-[62%] h-[2.5px] w-[2.5px] rounded-full bg-[#3EF7FF] opacity-40" />
        </div>
    );
}

function Panel({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={clsx(
                'border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_34px_rgba(0,0,0,0.22)] backdrop-blur-xl',
                className,
            )}
        >
            {children}
        </section>
    );
}

function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p className={clsx('text-[clamp(0.66rem,0.85vw,1rem)] font-normal uppercase tracking-[0.3em] text-[#53EAFD]/70', className)}>
            {children}
        </p>
    );
}

function TopBadge({
    icon: Icon,
    children,
    tone = 'cyan',
}: {
    icon?: HudIcon;
    children: ReactNode;
    tone?: 'cyan' | 'purple';
}) {
    return (
        <div
            className={clsx(
                'flex h-[clamp(2.1rem,3.4vw,2.6rem)] items-center gap-[clamp(0.4rem,0.6vw,0.6rem)] rounded-[10px] border bg-[#080E16]/50 px-[clamp(0.7rem,1vw,0.9rem)] text-[clamp(0.6rem,0.72vw,0.7rem)] font-bold uppercase tracking-[0.1em] text-[#A9BBC8]',
                tone === 'cyan'
                    ? 'border-[rgba(62,247,255,0.3)] shadow-[0_0_28px_rgba(38,217,238,0.08)]'
                    : 'border-[rgba(180,71,255,0.34)] shadow-[0_0_28px_rgba(179,72,255,0.1)]',
            )}
        >
            {Icon ? <Icon className={clsx('h-[9px] w-[9px] shrink-0', tone === 'cyan' ? 'text-[#4DFFB3]' : 'text-purple-200')} /> : null}
            <span className="min-w-0 truncate">{children}</span>
        </div>
    );
}

function ProgressStrip({ progressPercent, currentStepIndex, totalSteps }: { progressPercent: number; currentStepIndex: number; totalSteps: number }) {
    return (
        <div className="mt-[clamp(0.6rem,1vw,0.75rem)] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[clamp(0.6rem,1vw,0.9rem)]">
            <SectionLabel>Progress</SectionLabel>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#00D3F3] to-[#A2F4FD] shadow-[0_0_22px_rgba(0,211,243,0.44)]"
                    initial={false}
                    animate={{ width: `${Math.max(4, progressPercent)}%` }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                />
            </div>
            <p className="font-mono text-[clamp(0.7rem,0.9vw,0.9rem)] font-normal text-[#53EAFD]/70">
                {totalSteps > 0 ? `${currentStepIndex + 1}/${totalSteps}` : '--'}
            </p>
        </div>
    );
}

function CircularTimer({
    index,
    label,
    value,
    progress,
    tone = 'cyan',
    boxed = false,
}: {
    index: number;
    label: string;
    value: string;
    progress: number;
    tone?: 'cyan' | 'purple';
    boxed?: boolean;
}) {
    const stroke = tone === 'cyan' ? cyan : purple;
    const dimStroke = tone === 'cyan' ? 'rgba(62, 247, 255, 0.28)' : 'rgba(180, 71, 255, 0.3)';
    const glowStroke = tone === 'cyan' ? 'rgba(62, 247, 255, 0.62)' : 'rgba(180, 71, 255, 0.62)';
    const circumference = 2 * Math.PI * 47;
    const dashOffset = circumference - circumference * Math.min(Math.max(progress, 0), 100) / 100;

    return (
        <div
            className={clsx(
                'relative mx-auto flex w-full max-w-[18rem] flex-col items-center',
                boxed && 'rounded-[16px] border border-[rgba(180,71,255,0.28)] bg-[rgba(180,71,255,0.06)] px-5 py-5 shadow-[0_0_30px_rgba(180,71,255,0.12)]',
            )}
        >
            <p className={clsx('mb-2 font-mono text-[clamp(0.85rem,1.1vw,1rem)] font-bold', tone === 'cyan' ? 'text-[#7DFBFF]' : 'text-[#B447FF]')}>
                ({index})
            </p>
            <div className="relative aspect-square w-[min(13.5vw,168px)] min-w-[120px]">
                <svg className="-rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                    {/* Outer dim ring */}
                    <circle cx="60" cy="60" r="56" fill="none" stroke={dimStroke} strokeWidth="1" />
                    {/* Inner dim ring */}
                    <circle cx="60" cy="60" r="45" fill="none" stroke={dimStroke} strokeWidth="1" />
                    {/* Glow ring */}
                    <circle cx="60" cy="60" r="50" fill="none" stroke={glowStroke} strokeWidth="2" opacity="0.5" />
                    {/* Animated progress ring */}
                    <motion.circle
                        cx="60"
                        cy="60"
                        r="47"
                        fill="none"
                        stroke={stroke}
                        strokeLinecap="round"
                        strokeWidth="6"
                        strokeDasharray={circumference}
                        animate={{ strokeDashoffset: dashOffset }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                    {/* Dashed inner decorative ring */}
                    <circle
                        cx="60" cy="60" r="40"
                        fill="none"
                        stroke={dimStroke}
                        strokeWidth="0.8"
                        strokeDasharray="3 1.5"
                        opacity="0.5"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className={clsx('max-w-[8.5rem] truncate text-[clamp(0.55rem,0.72vw,0.7rem)] font-bold uppercase tracking-[0.15em]', tone === 'cyan' ? 'text-[#7DFBFF]' : 'text-[#D89AFF]')}>
                        {label}
                    </p>
                    <p className="mt-1 font-mono text-[clamp(1.5rem,2.4vw,1.8rem)] font-bold leading-none text-white">
                        {value}
                    </p>
                </div>
            </div>
        </div>
    );
}

function TimerRail({
    recipe,
    stepTimerMinutes,
    mode,
}: {
    recipe: Recipe | null;
    stepTimerMinutes: number | null;
    mode: ProjectionHudMode;
}) {
    const activeTitle = recipe?.title.split(/\s+/).slice(0, 2).join(' ') ?? 'Recipe';
    const secondLabel = recipe?.ingredients[1]?.name ?? 'Prep Timer';

    return (
        <Panel className="flex min-h-0 flex-col rounded-[24px] px-[clamp(0.8rem,1.2vw,1.2rem)] py-[clamp(0.9rem,1.4vw,1.4rem)]">
            <SectionLabel>Timers</SectionLabel>
            <div className="mt-5 flex min-h-0 flex-1 flex-col items-center justify-around gap-4">
                <CircularTimer
                    index={1}
                    label={mode === 'cooking' ? activeTitle : 'Start HUD'}
                    value={mode === 'cooking' ? formatClock(stepTimerMinutes, '01:28') : '--:--'}
                    progress={72}
                />
                <CircularTimer
                    index={2}
                    label={secondLabel}
                    value={formatClock(recipe?.cook_time_minutes, '04:15')}
                    progress={82}
                    tone="purple"
                    boxed
                />
                <CircularTimer
                    index={3}
                    label="Total Cook Time"
                    value={formatClock(recipe?.cook_time_minutes, '12:44')}
                    progress={100}
                />
            </div>
        </Panel>
    );
}



function RecipeMenu({
    recipes,
    selectedRecipeIndex,
    onSelect,
}: {
    recipes: Recipe[];
    selectedRecipeIndex: number;
    onSelect: (index: number) => void;
}) {
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => {
        itemRefs.current[selectedRecipeIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    }, [selectedRecipeIndex]);

    return (
        <Panel className="flex min-h-0 flex-col rounded-[24px] px-[clamp(1.4rem,2.5vw,3rem)] py-[clamp(1.35rem,2.3vw,2.75rem)]">
            <div className="mb-6 text-center">
                <SectionLabel className="text-center">Recipe</SectionLabel>
                <h1 className="mt-4 text-[clamp(2rem,3.2vw,3.6rem)] font-medium uppercase tracking-[0.03em] text-white">Choose Dish</h1>
                <p className="mt-3 text-white/50">Use menu gestures or click a recipe to begin.</p>
            </div>
            <div className="grid min-h-0 gap-3 overflow-y-auto pr-2 no-scrollbar">
                {recipes.length > 0 ? recipes.map((recipe, index) => {
                    const selected = index === selectedRecipeIndex;
                    return (
                        <button
                            key={recipe.id}
                            ref={(el) => { itemRefs.current[index] = el; }}
                            onClick={() => onSelect(index)}
                            className={clsx(
                                'grid min-h-[5.25rem] grid-cols-[3.3rem_minmax(0,1fr)_auto] items-center gap-4 rounded-[16px] border px-4 text-left transition',
                                selected
                                    ? 'border-[rgba(0,211,243,0.5)] bg-[rgba(0,211,243,0.1)] shadow-[0_0_34px_rgba(0,211,243,0.16)]'
                                    : 'border-white/10 bg-white/[0.035] hover:border-cyan-200/30 hover:bg-white/[0.06]',
                            )}
                        >
                            <span className={clsx('flex h-12 w-12 items-center justify-center rounded-[12px] font-mono text-lg font-black', selected ? 'bg-[#00D3F3] text-[#0A0F1A]' : 'bg-slate-700/50 text-slate-300')}>
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-xl font-black uppercase tracking-[0.04em] text-white">{recipe.title}</span>
                                <span className="mt-1 block truncate text-sm font-semibold text-slate-400">
                                    {recipe.cuisine ?? 'Kitchen'} / {formatMinutes(recipe.cook_time_minutes)} / {recipe.difficulty ?? 'Any skill'}
                                </span>
                            </span>
                            <span className={clsx('rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em]', selected ? 'bg-[#00D3F3] text-[#0A0F1A]' : 'bg-white/8 text-slate-400')}>
                                {selected ? 'Ready' : 'Scan'}
                            </span>
                        </button>
                    );
                }) : (
                    <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-8 text-center text-slate-300">
                        No recipes loaded.
                    </div>
                )}
            </div>
        </Panel>
    );
}

function IdlePanel({ onStart, isLoading, error }: { onStart: () => void; isLoading: boolean; error: string | null }) {
    return (
        <Panel className="flex min-h-0 flex-col items-center justify-center rounded-[24px] px-10 text-center">
            <motion.div
                className="mb-8 flex h-[clamp(7rem,12vw,12rem)] w-[clamp(7rem,12vw,12rem)] items-center justify-center rounded-full border border-cyan-200/35 bg-cyan-300/8 shadow-[0_0_90px_rgba(38,217,238,0.18)]"
                animate={{ scale: [1, 1.035, 1] }}
                transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
            >
                <ChefHat className="h-20 w-20 text-cyan-100" />
            </motion.div>
            <SectionLabel className="text-center">Local Interactive Kitchen</SectionLabel>
            <h1 className="mt-4 text-[clamp(3rem,6vw,6.8rem)] font-medium uppercase tracking-[0.15em] text-white">CoCI</h1>
            <p className="mt-5 max-w-2xl text-[clamp(1rem,1.5vw,1.5rem)] font-normal leading-relaxed text-white/50">
                Hands-free recipe guidance projected over the cooking surface.
            </p>
            {error ? <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-rose-300">{error}</p> : null}
            <button
                onClick={onStart}
                className="mt-9 inline-flex h-14 items-center justify-center rounded-full bg-[#00D3F3] px-8 text-sm font-bold uppercase tracking-[0.2em] text-[#0A0F1A] shadow-[0_0_34px_rgba(0,211,243,0.24)] transition hover:scale-[1.02]"
            >
                {isLoading ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : null}
                Start HUD
            </button>
        </Panel>
    );
}

function UtilityPanel({
    recipe,
    selectedRecipe,
    mode,
}: {
    recipe: Recipe | null;
    selectedRecipe: Recipe | null;
    mode: ProjectionHudMode;
}) {
    const activeRecipe = recipe ?? selectedRecipe;
    const ingredients = activeRecipe?.ingredients.slice(0, 9) ?? [];
    const utensils = ['Skillet', 'Spatula', 'Timer'];

    return (
        <Panel className="flex min-h-0 flex-col rounded-[24px] px-[clamp(0.8rem,1.2vw,1.2rem)] py-[clamp(0.9rem,1.4vw,1.4rem)]">
            <SectionLabel>Ingredients</SectionLabel>
            <div className="mt-5 grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, index) => {
                    const ing = ingredients[index];
                    return (
                        <div
                            key={index}
                            className="relative aspect-square flex flex-col items-center justify-center p-1 rounded-[14px] border border-white/10 bg-white/[0.04] text-center"
                        >
                            {ing ? (
                                <>
                                    <span className="text-[clamp(0.5rem,0.6vw,0.65rem)] font-bold text-white uppercase text-center break-words w-full px-0.5 line-clamp-2">
                                        {ing.name}
                                    </span>
                                    <span className="text-[clamp(0.4rem,0.5vw,0.55rem)] text-cyan-300/60 font-mono mt-0.5">
                                        {ing.amount} {ing.unit}
                                    </span>
                                </>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            <div className="mt-[clamp(0.9rem,1.6vw,1.6rem)]">
                <SectionLabel>Utensils</SectionLabel>
                <div className="mt-3 border-t border-white/10 pt-3">
                    {utensils.map(item => (
                        <div key={item} className="mb-2 flex items-center gap-[clamp(0.35rem,0.55vw,0.55rem)] text-[clamp(0.6rem,0.75vw,0.72rem)] font-normal text-[#A9BBC8]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[rgba(62,247,255,0.5)]" />
                            {item}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-auto">
                <SectionLabel>Stove Status</SectionLabel>
                <div className="mt-3 border-t border-white/10 pt-3">
                    <p
                        className={clsx(
                            'text-[clamp(1.5rem,2.2vw,1.8rem)] font-bold uppercase leading-none',
                            mode === 'idle' ? 'text-amber-200' : 'text-[#7FFFC8]',
                        )}
                        style={{ textShadow: '0 4px 4px rgba(0,0,0,0.25)' }}
                    >
                        {modeLabel(mode)}
                    </p>
                    <div className="mt-4 grid gap-1.5 text-[clamp(0.6rem,0.75vw,0.72rem)] font-normal">
                        <div className="flex items-center justify-between gap-3 text-[#F4FBFF]">
                            <span>Left Hand:</span>
                            <span className={clsx(mode === 'idle' ? 'text-[#A9BBC8]' : 'font-bold text-[#FF5A6A]')}>
                                {mode === 'idle' ? 'Miss' : 'Detected'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[#F4FBFF]">
                            <span>Right Hand:</span>
                            <span className="text-[#A9BBC8]">{mode === 'cooking' ? 'Miss' : 'Ready'}</span>
                        </div>
                    </div>
                    <div className="mt-5 min-h-[2.8rem] rounded-[14px] border border-white/10 bg-white/[0.04] px-[clamp(0.6rem,0.9vw,0.9rem)] py-[clamp(0.5rem,0.75vw,0.75rem)] text-[clamp(0.6rem,0.8vw,0.78rem)] font-normal text-white/50">
                        {ingredients.length > 0
                            ? ingredients.slice(0, 3).map(item => item.name).join(' / ')
                            : 'Notes / details placeholder'}
                    </div>
                </div>
            </div>
        </Panel>
    );
}

function LoadingOrError({ isLoading, error }: { isLoading: boolean; error: string | null }) {
    if (!isLoading && !error) return null;

    return (
        <div className="pointer-events-none absolute left-1/2 top-[7.4rem] z-30 -translate-x-1/2 rounded-full border border-white/10 bg-[#0F1626]/80 px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
            {isLoading ? 'Loading recipes' : error}
        </div>
    );
}

export const RecipeManager = () => {
    const hud = useProjectionHud();
    const { isConnected } = useWebSocket();
    const ConnectionIcon = isConnected ? Wifi : WifiOff;

    if (hud.mode === 'idle' || hud.mode === 'menu') {
        return (
            <WelcomeMenu
                recipes={hud.recipes}
                selectedRecipeIndex={hud.selectedRecipeIndex}
                onSelectRecipe={hud.selectRecipe}
                lastAction={hud.lastAction}
            />
        );
    }

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-[#0A0F1A] p-[clamp(0.8rem,1.4vw,1.5rem)]">
            {/* Background radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(0,211,243,0.08),transparent_36%),linear-gradient(180deg,rgba(10,15,26,0.96),rgba(10,12,20,0.98))]" />

            {/* Scatter dot decorations */}
            <ScatterDots />

            {/* Main HUD container */}
            <div
                className="relative grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-[36px] bg-[#0F1626] p-[clamp(1rem,1.5vw,1.6rem)]"
                style={{
                    border: '0.8px solid rgba(0,184,219,0.2)',
                    boxShadow: '0 0 60px rgba(0,200,255,0.13)',
                }}
            >
                {/* ── Top status bar ── */}
                <div className="relative z-20">
                    <div className="grid grid-cols-[minmax(14rem,22rem)_minmax(0,1fr)_minmax(18rem,28rem)] items-center gap-5">
                        <TopBadge icon={CircleDot}>WebSocket {isConnected ? 'Connected' : 'Disconnected'}</TopBadge>
                        <div />
                        <TopBadge tone="purple" icon={Hand}>Last Gesture: {actionLabel(hud.lastAction)}</TopBadge>
                    </div>
                    <ProgressStrip
                        progressPercent={hud.progressPercent}
                        currentStepIndex={hud.currentStepIndex}
                        totalSteps={hud.totalSteps}
                    />
                </div>

                <LoadingOrError isLoading={hud.isLoadingRecipes} error={hud.recipeError} />

                {/* ── Body Content (Three-column or Figma Cooking Panel) ── */}
                <AnimatePresence mode="wait">
                    {hud.mode === 'cooking' ? (
                        <motion.div
                            key="cooking-panel"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            className="mt-[clamp(0.6rem,1vw,0.8rem)] min-h-0 flex-1 flex"
                        >
                            <FigmaCookingPanel
                                recipe={hud.currentRecipe}
                                currentStepIndex={hud.currentStepIndex}
                                totalSteps={hud.totalSteps}
                                description={hud.currentStepDescription}
                                onNextStep={hud.nextStep}
                                onPreviousStep={hud.previousStep}
                                stepTimerMinutes={hud.currentStepTimerMinutes}
                                mode={hud.mode}
                                lastAction={hud.lastAction}
                                isConnected={isConnected}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="standard-panel"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.28 }}
                            className="mt-[clamp(0.6rem,1vw,0.8rem)] grid min-h-0 grid-cols-[minmax(13rem,24vw)_minmax(0,1fr)_minmax(14rem,24vw)] gap-[clamp(0.8rem,1.2vw,1.2rem)] flex-1"
                        >
                            <TimerRail
                                recipe={hud.currentRecipe ?? hud.selectedRecipe}
                                stepTimerMinutes={hud.currentStepTimerMinutes}
                                mode={hud.mode}
                            />

                            <div className="min-h-0">
                                <AnimatePresence mode="wait">
                                    {hud.mode === 'idle' ? (
                                        <motion.div
                                            key="idle"
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -16 }}
                                            transition={{ duration: 0.28 }}
                                            className="h-full"
                                        >
                                            <IdlePanel onStart={hud.startApp} isLoading={hud.isLoadingRecipes} error={hud.recipeError} />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="menu"
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -16 }}
                                            transition={{ duration: 0.28 }}
                                            className="h-full"
                                        >
                                            <RecipeMenu
                                                recipes={hud.recipes}
                                                selectedRecipeIndex={hud.selectedRecipeIndex}
                                                onSelect={hud.selectRecipe}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <UtilityPanel
                                recipe={hud.currentRecipe}
                                selectedRecipe={hud.selectedRecipe}
                                mode={hud.mode}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <ConnectionIcon className="pointer-events-none absolute right-10 bottom-9 h-5 w-5 text-cyan-100/20" />
            </div>
        </div>
    );
};
