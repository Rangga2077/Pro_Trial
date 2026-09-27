import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useProjectionHud } from '../../hooks/useProjectionHud';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';
import {
    type TransitionDirection,
    getTransitionDirection,
    screenTransitionVariants,
} from './screenTransitions';
import { EdgePulse } from './EdgePulse';
import { GestureStatusRail } from './GestureStatusRail';
import { IngredientCheck } from './IngredientCheck';
import { RecipeHud } from './RecipeHud';
import { RecipeMenu } from './RecipeMenu';
import { UtilityStatusPanel } from './UtilityStatusPanel';

/* ── Transition direction tracker ─────────────────────────────────── *
 * Uses the "adjusting state during render" pattern (React docs) so we
 * can derive direction without reading refs during render or calling
 * setState inside effects.
 * ─────────────────────────────────────────────────────────────────── */

function useTransitionDirection(mode: ProjectionHudMode) {
    const [tracked, setTracked] = useState({
        prevMode: null as ProjectionHudMode | null,
        currentMode: mode,
        direction: 'initial' as TransitionDirection,
        isFirstMount: true,
    });

    if (tracked.currentMode !== mode) {
        setTracked({
            prevMode: tracked.currentMode,
            currentMode: mode,
            direction: getTransitionDirection(tracked.currentMode, mode),
            isFirstMount: false,
        });
    }

    return { direction: tracked.direction, isFirstMount: tracked.isFirstMount };
}

export const ProjectionHud: React.FC = () => {
    const hud = useProjectionHud();
    const isCooking = hud.mode === 'cooking';
    const isIngredientCheck = hud.mode === 'ingredient_check';

    const { direction, isFirstMount } = useTransitionDirection(hud.mode);

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* ── Animated screen container ─────────────────────────── */}
            <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                    key={hud.mode}
                    custom={direction}
                    variants={screenTransitionVariants}
                    initial={isFirstMount ? false : 'initial'}
                    animate="animate"
                    exit="exit"
                    className="absolute inset-0"
                >
                    {hud.mode === 'menu' && (
                        <RecipeMenu
                            recipes={hud.recipes}
                            selectedIndex={hud.selectedRecipeIndex}
                            isLoading={hud.isLoadingRecipes}
                            error={hud.recipeError}
                            onSelect={hud.selectRecipe}
                            onNext={hud.nextRecipe}
                            onPrevious={hud.previousRecipe}
                            onClose={hud.closeMenu}
                        />
                    )}

                    {isIngredientCheck && hud.currentRecipe && (
                        <IngredientCheck
                            recipe={hud.currentRecipe}
                            isConnected={hud.isConnected}
                            lastAction={hud.lastAction}
                            onReady={hud.startCooking}
                            onBack={hud.openMenu}
                            theme={hud.theme}
                            onToggleTheme={hud.toggleTheme}
                        />
                    )}

                    {isCooking && hud.currentRecipe && (
                        <RecipeHud
                            recipe={hud.currentRecipe}
                            stepNumber={hud.currentStepNumber}
                            totalSteps={hud.totalSteps}
                            instruction={hud.currentInstruction}
                            progressPercent={hud.progressPercent}
                            onNextStep={hud.nextStep}
                            onPreviousStep={hud.previousStep}
                            onOpenMenu={hud.openMenu}
                            isConnected={hud.isConnected}
                            lastAction={hud.lastAction}
                            theme={hud.theme}
                            onToggleTheme={hud.toggleTheme}
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* ── Edge pulse overlay (fires on mode change) ──────── */}
            <EdgePulse mode={hud.mode} />

            {/* Gesture hint rail — shown in all modes */}
            <GestureStatusRail
                mode={hud.mode}
                lastAction={hud.lastAction}
            />

            {/* Status overlay — shown only during ingredient check and cooking */}
            {(isCooking || isIngredientCheck) && (
                <UtilityStatusPanel
                    mode={hud.mode}
                    isConnected={hud.isConnected}
                    currentRecipe={hud.currentRecipe}
                    selectedRecipe={hud.selectedRecipe}
                />
            )}
        </div>
    );
};
