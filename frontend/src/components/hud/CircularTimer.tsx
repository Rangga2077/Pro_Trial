import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import svgPaths from '../svgTimerRings';

export interface CircularTimerProps {
    index: number;
    label: string;
    value: string;
    progress: number;
    tone?: 'cyan' | 'purple';
    boxed?: boolean;
}

export const CircularTimer: React.FC<CircularTimerProps> = ({
    index,
    label,
    value,
    progress,
    tone = 'cyan',
    boxed = false,
}) => {
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
            <p className={clsx(
                "font-bold text-[clamp(11px,1.1vw,13px)] tracking-[0.1em] mb-1",
                tone === 'cyan' ? 'text-[#7dfbff]' : 'text-[#b447ff]'
            )}>
                ({index})
            </p>

            <div className="relative size-[clamp(110px,13.5vw,168px)]">
                <svg className="absolute inset-0 size-full" fill="none" viewBox="0 0 168 168" preserveAspectRatio="xMidYMid meet">
                    <g>
                        <path
                            d={svgPaths.p3ff9e000}
                            stroke={strokeColor}
                            strokeOpacity={dimOpacity}
                            strokeWidth="4"
                        />
                        <path
                            d={svgPaths.p1cb6a770}
                            stroke={strokeColor}
                            strokeOpacity={glowOpacity}
                            strokeWidth="3"
                        />
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

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                    <p className={clsx(
                        "font-bold text-[clamp(8px,0.72vw,10px)] tracking-[0.15em] uppercase w-full truncate px-2",
                        tone === 'cyan' ? 'text-[#7dfbff]' : 'text-[#d89aff]'
                    )}>
                        {label}
                    </p>
                    <p className="font-bold text-[clamp(1.2rem,2.1vw,1.6rem)] text-white mt-0.5 tracking-[0.05em]">
                        {value}
                    </p>
                </div>
            </div>
        </div>
    );
};
