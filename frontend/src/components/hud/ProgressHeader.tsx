import { motion } from 'framer-motion';

export interface ProgressHeaderProps {
    stepNumber: number;
    totalSteps: number;
    progressPercent: number;
}

export const ProgressHeader: React.FC<ProgressHeaderProps> = ({
    stepNumber,
    totalSteps,
    progressPercent,
}) => {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-cyan-200 text-xs font-bold tracking-widest uppercase">
                    PROGRESS
                </span>
                <span className="text-cyan-300 text-sm font-bold">
                    {stepNumber} / {totalSteps}
                </span>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
};
