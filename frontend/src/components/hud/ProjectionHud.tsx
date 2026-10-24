import React, { useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { useProjectionHud } from '../../hooks/useProjectionHud';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';
import {
    type ScreenTransitionCustom,
    type TransitionKey,
    getTransitionAccent,
    getTransitionKey,
    screenTransitionVariants,
} from './screenTransitions';
import { EdgePulse } from './EdgePulse';
import { GestureStatusRail } from './GestureStatusRail';
import { IngredientCheck } from './IngredientCheck';
import { RecipeHud } from './RecipeHud';
import { RecipeMenu } from './RecipeMenu';

/* ── Transition key tracker ───────────────────────────────────────── *
 * Uses the "adjusting state during render" pattern (React docs) so we
 * can derive the transition without reading refs during render or
 * calling setState inside effects.
 * ─────────────────────────────────────────────────────────────────── */

function useTransitionKey(mode: ProjectionHudMode) {
    const [tracked, setTracked] = useState({
        prevMode: null as ProjectionHudMode | null,
        currentMode: mode,
        key: 'initial' as TransitionKey,
        isFirstMount: true,
    });

    if (tracked.currentMode !== mode) {
        setTracked({
            prevMode: tracked.currentMode,
            currentMode: mode,
            key: getTransitionKey(tracked.currentMode, mode),
            isFirstMount: false,
        });
    }

    return { transitionKey: tracked.key, isFirstMount: tracked.isFirstMount };
}

export const ProjectionHud: React.FC = () => {
    const hud = useProjectionHud();
    const isCooking = hud.mode === 'cooking';
    const isIngredientCheck = hud.mode === 'ingredient_check';

    const { transitionKey, isFirstMount } = useTransitionKey(hud.mode);
    const reduced = useReducedMotion() ?? false;
    const transitionCustom: ScreenTransitionCustom = { key: transitionKey, reduced };

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* ── Animated screen container ─────────────────────────── *
             * Screens overlap during a switch; zIndex comes from the
             * transition variants. LayoutGroup scopes the shared recipe
             * card → ingredient card layoutIds.
             * ─────────────────────────────────────────────────────── */}
            <MotionConfig reducedMotion="user">
                <LayoutGroup id="projection-hud">
                    <AnimatePresence custom={transitionCustom}>
                        <motion.div
                            key={hud.mode}
                            custom={transitionCustom}
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
                                    voiceState={hud.voiceState}
                                    voiceCommand={hud.voiceCommand}
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
                                    voiceState={hud.voiceState}
                                    voiceCommand={hud.voiceCommand}
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
                                    theme={hud.theme}
                                    onToggleTheme={hud.toggleTheme}
                                    voiceState={hud.voiceState}
                                    voiceCommand={hud.voiceCommand}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </LayoutGroup>
            </MotionConfig>

            {/* ── Edge pulse overlay (fires on mode change) ──────── */}
            <EdgePulse
                mode={hud.mode}
                accent={reduced ? null : getTransitionAccent(transitionKey)}
            />

            {/* Gesture hint rail — menu only. Ingredient Check and Cooking
                have their own Gesture Guide panel and LAST GESTURE pill
                (and show connection/recipe info in their layouts), so the
                floating overlays would only cover their panels. */}
            {hud.mode === 'menu' && (
                <GestureStatusRail
                    mode={hud.mode}
                    lastAction={hud.lastAction}
                    voiceListening={hud.voiceState === 'listening'}
                />
            )}
        </div>
    );
};
