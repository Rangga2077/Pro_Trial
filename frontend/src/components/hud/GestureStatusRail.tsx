import { motion, AnimatePresence } from 'framer-motion';
import type { GestureAction } from '../../types/contracts';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';

export interface GestureStatusRailProps {
    mode: ProjectionHudMode;
    lastAction: GestureAction | null;
}

const gestureHints: Record<ProjectionHudMode, { gesture: string; action: string }[]> = {
    menu: [
        { gesture: 'Left/Right index', action: 'NAVIGATE' },
        { gesture: 'Closed fist', action: 'SELECT' },
        { gesture: 'Open palm', action: 'BACK' },
    ],
    ingredient_check: [
        { gesture: 'Hold item above zone', action: 'SCAN' },
        { gesture: 'Open palm', action: 'BACK TO MENU' },
    ],
    cooking: [
        { gesture: 'Right index', action: 'NEXT STEP' },
        { gesture: 'Left index', action: 'PREV STEP' },
        { gesture: 'Closed fist', action: 'MENU' },
    ],
};

export const GestureStatusRail: React.FC<GestureStatusRailProps> = ({ mode, lastAction }) => {
    const hints = gestureHints[mode];

    return (
        <div className="fixed bottom-4 left-4 z-20">
            <motion.div
                className="flex flex-col gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {hints.map((hint, idx) => (
                    <motion.div
                        key={`${mode}-${idx}`}
                        className="px-3 py-2 bg-slate-950/80 border border-cyan-300/30 rounded-lg text-xs font-mono text-cyan-200 backdrop-blur"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                    >
                        <span className="text-cyan-400">{hint.gesture}</span>
                        <span className="text-slate-400 mx-2">→</span>
                        <span className="text-slate-300">{hint.action}</span>
                    </motion.div>
                ))}

                <AnimatePresence>
                    {lastAction && lastAction !== 'NO_ACTION' && (
                        <motion.div
                            key="last-action"
                            className="mt-2 px-3 py-2 bg-purple-950/60 border border-purple-400/40 rounded-lg text-xs font-bold text-purple-300 backdrop-blur text-center"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            {lastAction.replace(/_/g, ' ')}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
