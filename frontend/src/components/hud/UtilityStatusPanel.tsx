import { motion } from 'framer-motion';
import type { Recipe } from '../../types/contracts';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';
import { GlassPanel } from './GlassPanel';

export interface UtilityStatusPanelProps {
    mode: ProjectionHudMode;
    isConnected: boolean;
    currentRecipe: Recipe | null;
    selectedRecipe: Recipe | null;
}

export const UtilityStatusPanel: React.FC<UtilityStatusPanelProps> = ({
    mode,
    isConnected,
    currentRecipe,
}) => {
    return (
        <GlassPanel className="fixed bottom-4 right-4 w-64 p-4 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto z-20">
            {/* Connection Status */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <motion.div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: isConnected ? '#4DFFB3' : '#FF5A6A' }}
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-xs font-mono tracking-widest text-slate-300">
                        {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                </div>
            </div>

            {mode === 'cooking' && currentRecipe && (
                <>
                    {/* Recipe Title */}
                    <div className="border-t border-cyan-300/20 pt-3">
                        <p className="text-xs tracking-widest text-cyan-200/70 uppercase mb-1">RECIPE</p>
                        <p className="text-sm font-bold text-white truncate">{currentRecipe.title}</p>
                    </div>

                    {/* Key Ingredients */}
                    {currentRecipe.ingredients.length > 0 && (
                        <div className="border-t border-cyan-300/20 pt-3">
                            <p className="text-xs tracking-widest text-cyan-200/70 uppercase mb-2">KEY INGREDIENTS</p>
                            <div className="space-y-1">
                                {currentRecipe.ingredients.slice(0, 3).map((ing) => (
                                    <div key={ing.name} className="text-xs text-slate-300 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-cyan-400" />
                                        <span>{ing.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Timing */}
                    <div className="border-t border-cyan-300/20 pt-3">
                        <p className="text-xs tracking-widest text-cyan-200/70 uppercase mb-2">TIMING</p>
                        <div className="space-y-1 text-xs text-slate-300">
                            {currentRecipe.prep_time_minutes && (
                                <div>Prep: <span className="text-cyan-300">{currentRecipe.prep_time_minutes} min</span></div>
                            )}
                            {currentRecipe.cook_time_minutes && (
                                <div>Cook: <span className="text-cyan-300">{currentRecipe.cook_time_minutes} min</span></div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </GlassPanel>
    );
};
