import { motion } from 'framer-motion';
import { GlassPanel } from './GlassPanel';

export interface StartScreenProps {
    isConnected: boolean;
    isLoadingRecipes: boolean;
    recipeError: string | null;
    onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
    isConnected,
    isLoadingRecipes,
    recipeError,
    onStart,
}) => {
    return (
        <div className="flex items-center justify-center h-full w-full">
            <motion.div
                className="text-center space-y-8"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                {/* Scanner Ring */}
                <div className="flex justify-center">
                    <div className="relative size-40">
                        <motion.div
                            className="absolute inset-0 rounded-full border-2 border-cyan-400"
                            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        />
                        <motion.div
                            className="absolute inset-2 rounded-full border border-dashed border-cyan-400"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                                className="w-3 h-3 rounded-full bg-cyan-400"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                    <h1 className="text-4xl font-satoshi-light tracking-widest text-white uppercase">
                        JUST YOU AND YOUR RECIPES
                    </h1>
                    <p className="text-sm tracking-widest text-white/60 font-satoshi">
                        INTERACTIVE COOKING SYSTEM 1.0
                    </p>
                </div>

                {/* Status Messages */}
                <div className="space-y-3">
                    {isLoadingRecipes && (
                        <motion.p
                            className="text-sm text-slate-300 font-mono"
                            animate={{ opacity: [0.5, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        >
                            Loading recipes...
                        </motion.p>
                    )}

                    {recipeError && (
                        <GlassPanel className="p-3 border-rose-500/50 bg-rose-950/20">
                            <p className="text-sm text-rose-300 font-mono">{recipeError}</p>
                        </GlassPanel>
                    )}

                    <div className="flex items-center justify-center gap-2">
                        <motion.div
                            className="w-2 h-2 rounded-full"
                            style={{
                                backgroundColor: isConnected ? '#4DFFB3' : '#FF5A6A',
                            }}
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <span className="text-xs font-mono tracking-widest text-slate-300">
                            {isConnected ? 'SYSTEM READY' : 'AWAITING CONNECTION'}
                        </span>
                    </div>
                </div>

                {/* Instruction Text */}
                <p className="text-xs tracking-widest text-slate-400 max-w-xs mx-auto leading-relaxed font-mono">
                    USE BOTH INDEX FINGERS TO START
                </p>

                {/* Start Button (for manual trigger) */}
                {!isLoadingRecipes && (
                    <motion.button
                        onClick={onStart}
                        className="px-6 py-3 bg-cyan-500/20 border border-cyan-400 rounded-lg text-cyan-300 font-bold tracking-widest uppercase text-sm hover:bg-cyan-500/30 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Initialize
                    </motion.button>
                )}
            </motion.div>
        </div>
    );
};
