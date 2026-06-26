import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import type { Recipe, GestureAction } from '../types/contracts';
import svgPaths from './svgTimerRings';
import { clsx } from 'clsx';

interface FigmaCookingPanelProps {
    recipe: Recipe | null;
    currentStepIndex: number;
    totalSteps: number;
    description: string | null;
    onNextStep: () => void;
    onPreviousStep: () => void;
    stepTimerMinutes: number | null;
    mode: string;
    lastAction: GestureAction | null;
    isConnected: boolean;
}

function formatClock(minutes?: number | null, fallback = '--:--') {
    if (!minutes) return fallback;
    return `${String(minutes).padStart(2, '0')}:00`;
}

// Custom responsive circular timer matching Figma SVG structure and paths
interface CircularTimerProps {
    index: number;
    label: string;
    value: string;
    progress: number;
    tone?: 'cyan' | 'purple';
    boxed?: boolean;
}

function FigmaCircularTimer({
    index,
    label,
    value,
    progress,
    tone = 'cyan',
    boxed = false,
}: CircularTimerProps) {
    const strokeColor = tone === 'cyan' ? '#3EF7FF' : '#B447FF';
    const dimOpacity = 0.28;
    const glowOpacity = 0.62;
    const totalLength = 427.26;
    const dashArray = `${(progress / 100) * totalLength} ${totalLength}`;

    return (
        <div
            className={clsx(
                "relative flex flex-col items-center justify-center w-full transition-all duration-300",
                boxed
                    ? "bg-[rgba(180,71,255,0.06)] rounded-[16px] border border-[rgba(180,71,255,0.28)] shadow-[0px_0px_30px_0px_rgba(180,71,255,0.12)] p-[clamp(0.6rem,1vw,1rem)]"
                    : "p-[clamp(0.2rem,0.5vw,0.6rem)]"
            )}
        >
            {/* Index label */}
            <p className={clsx(
                "font-['Inter:Bold',sans-serif] font-bold text-[clamp(11px,1.1vw,13px)] tracking-[0.1em] mb-1",
                tone === 'cyan' ? 'text-[#7dfbff]' : 'text-[#b447ff]'
            )}>
                ({index})
            </p>

            {/* SVG Timer Ring */}
            <div className="relative size-[clamp(110px,13.5vw,168px)]">
                <svg className="absolute inset-0 size-full" fill="none" viewBox="0 0 168 168" preserveAspectRatio="xMidYMid meet">
                    <g>
                        {/* Outer dim background ring */}
                        <path
                            d={svgPaths.p3ff9e000}
                            stroke={strokeColor}
                            strokeOpacity={dimOpacity}
                            strokeWidth="4"
                        />
                        {/* Inner accent ring */}
                        <path
                            d={svgPaths.p1cb6a770}
                            stroke={strokeColor}
                            strokeOpacity={glowOpacity}
                            strokeWidth="3"
                        />
                        {/* Progress ring */}
                        <motion.path
                            d={svgPaths.p2c33ce00}
                            stroke={strokeColor}
                            strokeLinecap="round"
                            strokeWidth="9"
                            initial={{ strokeDasharray: `0 ${totalLength}` }}
                            animate={{ strokeDasharray: dashArray }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                    </g>
                </svg>

                {/* Inner text content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                    <p className={clsx(
                        "font-['Inter:Bold',sans-serif] font-bold text-[clamp(8px,0.72vw,10px)] tracking-[0.15em] uppercase w-full truncate px-2",
                        tone === 'cyan' ? 'text-[#7dfbff]' : 'text-[#d89aff]'
                    )}>
                        {label}
                    </p>
                    <p className="font-['Inter:Bold',sans-serif] font-bold text-[clamp(1.2rem,2.1vw,1.6rem)] text-white mt-0.5 tracking-[0.05em]">
                        {value}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function FigmaCookingPanel({
    recipe,
    currentStepIndex,
    totalSteps,
    description,
    onNextStep,
    onPreviousStep,
    stepTimerMinutes,
}: FigmaCookingPanelProps) {
    const activeTitle = recipe?.title.split(/\s+/).slice(0, 2).join(' ') ?? 'Recipe';
    const secondLabel = recipe?.ingredients[1]?.name ?? 'Prep Timer';
    const progressPercent = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

    const ingredients = useMemo(() => {
        return recipe?.ingredients.slice(0, 9) ?? [];
    }, [recipe]);

    const utensils = ['Skillet', 'Spatula', 'Timer'];

    return (
        <div className="flex-[538.4_0_0] min-h-px relative w-full" data-name="Container">
            <div className="content-stretch flex flex-col lg:flex-row gap-[clamp(12px,1.2vw,16px)] items-stretch relative size-full">
                
                {/* ── Left Column: Timers ── */}
                <div 
                    className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-[24px] w-full lg:w-[clamp(180px,18vw,220px)] flex flex-col gap-[clamp(10px,1vw,16px)] p-[clamp(12px,1vw,16.8px)] shrink-0" 
                    data-name="Container"
                >
                    <p className="font-['Inter:Regular',sans-serif] font-normal text-[clamp(10px,0.8vw,12px)] tracking-[3.6px] text-[rgba(83,234,253,0.7)] uppercase mb-1">
                        TIMERS
                    </p>
                    <div className="flex flex-row lg:flex-col justify-around gap-[clamp(10px,1vw,16px)] h-full">
                        <FigmaCircularTimer
                            index={1}
                            label={activeTitle}
                            value={formatClock(stepTimerMinutes, '01:28')}
                            progress={Math.min(95, 35 + currentStepIndex * 15)}
                        />
                        <FigmaCircularTimer
                            index={2}
                            label={secondLabel}
                            value={formatClock(recipe?.prep_time_minutes, '04:15')}
                            progress={75}
                            tone="purple"
                            boxed
                        />
                        <FigmaCircularTimer
                            index={3}
                            label="TOTAL COOK TIME"
                            value={formatClock(recipe?.cook_time_minutes, '12:44')}
                            progress={Math.min(100, Math.round(progressPercent))}
                        />
                    </div>
                </div>

                {/* ── Center Column: Recipe & Stove Target ── */}
                <div 
                    className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-[24px] flex-1 flex flex-col justify-between overflow-hidden relative" 
                    data-name="Container"
                >
                    {/* Header */}
                    <div className="text-center py-[clamp(12px,1.5vw,20px)] px-[clamp(12px,2vw,24px)]" data-name="Container">
                        <p className="font-['Inter:Regular',sans-serif] font-normal text-[clamp(10px,0.8vw,12px)] tracking-[3.6px] text-[rgba(83,234,253,0.7)] uppercase mb-2">
                            RECIPE
                        </p>
                        <h2 className="font-['Inter:Medium',sans-serif] font-medium text-[clamp(16px,1.6vw,22px)] text-white tracking-[0.6px] uppercase truncate">
                            {recipe?.title ?? 'Crispy Salmon with Asparagus'}
                        </h2>
                        <p className="font-['Inter:Regular',sans-serif] font-normal text-[clamp(10px,0.8vw,12px)] tracking-[3.6px] text-[#7dfbff] uppercase mt-1">
                            STEP {currentStepIndex + 1}
                        </p>
                        <p className="font-['Inter:Regular',sans-serif] font-normal text-[clamp(12px,1.1vw,15px)] text-[rgba(255,255,255,0.7)] mt-2 line-clamp-2">
                            {description ?? 'Sear the salmon skin-side down until crispy.'}
                        </p>
                    </div>

                    <div className="absolute bg-[rgba(255,255,255,0.1)] h-px left-0 top-[clamp(110px,12vw,140px)] w-full" data-name="Container" />

                    {/* Stove Target Visualization */}
                    <div className="relative flex-1 flex items-center justify-center min-h-[200px] lg:min-h-[260px] overflow-hidden">
                        {/* Radial Glow Layer 1 */}
                        <div className="absolute rounded-full bg-[rgba(0,211,243,0.07)] blur-[60px] size-[clamp(180px,26vw,340px)]" />
                        {/* Radial Glow Layer 2 */}
                        <div className="absolute rounded-full bg-[rgba(0,211,243,0.14)] blur-[30px] size-[clamp(150px,22vw,284px)]" />
                        
                        {/* Outer Glow Ring */}
                        <motion.div 
                            className="absolute rounded-full border-[1.6px] border-[rgba(0,211,243,0.4)] shadow-[0px_0px_60px_0px_rgba(34,211,238,0.38)] inset-auto size-[clamp(120px,18vw,224px)]"
                            animate={{ scale: [0.97, 1.03, 0.97], opacity: [0.75, 1, 0.75] }}
                            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                        />
                        
                        {/* Inner Solid Ring */}
                        <div className="absolute rounded-full border-[0.8px] border-[rgba(83,234,253,0.3)] shadow-[inset_0px_0px_30px_0px_rgba(34,211,238,0.22)] size-[clamp(90px,14vw,176px)]" />
                        
                        {/* Dashed Stove Ring */}
                        <div className="absolute rounded-full border-[0.8px] border-[rgba(83,234,253,0.4)] border-dashed bg-[rgba(0,211,243,0.05)] size-[clamp(65px,10vw,126px)] flex items-center justify-center">
                            <p className="font-['Inter:Medium',sans-serif] font-medium text-[clamp(9px,0.8vw,11px)] tracking-[3px] text-[rgba(162,244,253,0.65)] uppercase">
                                STOVE
                            </p>
                        </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div 
                        className="flex h-[clamp(50px,6vw,72px)] items-center justify-between border-t border-[rgba(255,255,255,0.08)] px-[clamp(16px,2vw,24px)] bg-[#0f1626]/20" 
                        data-name="Container"
                    >
                        <button 
                            onClick={onPreviousStep}
                            className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[26843500px] h-[clamp(32px,3.2vw,38.6px)] px-[clamp(12px,1.5vw,20px)] flex items-center gap-2 hover:bg-[rgba(255,255,255,0.1)] active:scale-95 transition-all text-[rgba(255,255,255,0.7)] text-[clamp(11px,1vw,14px)] font-['Inter:Medium',sans-serif] font-medium uppercase"
                        >
                            <ArrowLeft className="size-[clamp(12px,1.2vw,16px)]" />
                            <span>BACK</span>
                        </button>
                        <button 
                            onClick={onNextStep}
                            className="bg-[#00d3f3] rounded-[26843500px] h-[clamp(30px,3vw,37px)] px-[clamp(14px,1.8vw,24px)] flex items-center gap-2 hover:bg-[#3bf1ff] active:scale-95 transition-all text-[#0a0f1a] text-[clamp(11px,1vw,14px)] font-['Inter:Medium',sans-serif] font-medium uppercase tracking-[0.7px]"
                        >
                            <span>NEXT</span>
                            <ArrowRight className="size-[clamp(12px,1.2vw,16px)] text-[#0a0f1a]" />
                        </button>
                    </div>
                </div>

                {/* ── Right Column: Utilities ── */}
                <div 
                    className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-[24px] w-full lg:w-[clamp(180px,18vw,220px)] flex flex-col gap-[clamp(10px,1vw,16px)] p-[clamp(12px,1vw,16px)] shrink-0 justify-between h-full" 
                    data-name="Container"
                >
                    {/* Ingredients Section */}
                    <div className="flex flex-col gap-2">
                        <p className="font-['Inter:Regular',sans-serif] font-normal text-[clamp(10px,0.8vw,12px)] tracking-[3.6px] text-[rgba(83,234,253,0.7)] uppercase">
                            INGREDIENTS
                        </p>
                        <div className="grid grid-cols-3 gap-[clamp(4px,0.5vw,8px)]">
                            {Array.from({ length: 9 }).map((_, index) => {
                                const ing = ingredients[index];
                                return (
                                    <div 
                                        key={index} 
                                        className="aspect-square bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-[14px] flex flex-col items-center justify-center text-center p-1"
                                    >
                                        {ing ? (
                                            <>
                                                <span className="text-[clamp(8px,0.6vw,10px)] font-bold text-white uppercase break-words w-full px-0.5 line-clamp-2">
                                                    {ing.name}
                                                </span>
                                                <span className="text-[clamp(7px,0.5vw,9px)] text-cyan-300/60 font-mono mt-0.5">
                                                    {ing.amount} {ing.unit}
                                                </span>
                                            </>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Utensils Section */}
                    <div className="flex flex-col gap-2">
                        <p className="font-['Inter:Regular',sans-serif] font-normal text-[clamp(10px,0.8vw,12px)] tracking-[3.6px] text-[rgba(83,234,253,0.7)] uppercase">
                            UTENSILS
                        </p>
                        <div className="border-t border-[rgba(255,255,255,0.1)] pt-2 flex flex-col gap-1.5">
                            {utensils.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-[clamp(10px,0.8vw,12px)] font-normal text-[#A9BBC8]">
                                    <div className="rounded-full bg-[rgba(62,247,255,0.5)] size-[6px]" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stove Status Section */}
                    <div className="flex flex-col gap-2">
                        <p className="font-['Inter:Regular',sans-serif] font-normal text-[clamp(10px,0.8vw,12px)] tracking-[3.6px] text-[rgba(83,234,253,0.7)] uppercase">
                            STOVE STATUS
                        </p>
                        <div className="border-t border-[rgba(255,255,255,0.1)] pt-2 flex flex-col gap-2">
                            <h3 className="font-['Inter:Bold',sans-serif] font-bold text-[clamp(18px,1.8vw,26px)] text-[#7fffc8] leading-none uppercase filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]">
                                ACTIVE
                            </h3>
                            <div className="flex flex-col gap-1 text-[clamp(10px,0.8vw,12px)] text-[#f4fbff]">
                                <div className="flex justify-between items-center w-full">
                                    <span className="opacity-75">Left Hand:</span>
                                    <span className="font-['Inter:Bold',sans-serif] font-bold text-[#ff5a6a]">Detected</span>
                                </div>
                                <div className="flex justify-between items-center w-full">
                                    <span className="opacity-75">Right Hand:</span>
                                    <span className="text-[#a9bbc8]">Miss</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes placeholder */}
                    <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-[14px] p-2 min-h-[36px] flex items-center justify-center">
                        <p className="font-['Inter:Regular',sans-serif] text-[clamp(9px,0.7vw,11px)] text-[rgba(255,255,255,0.5)] text-center line-clamp-2 w-full">
                            {ingredients.length > 0
                                ? ingredients.slice(0, 3).map(item => item.name).join(' / ')
                                : 'Notes / details placeholder'}
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
