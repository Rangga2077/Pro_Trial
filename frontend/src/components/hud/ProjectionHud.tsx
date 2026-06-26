import React from 'react';
import { useProjectionHud } from '../../hooks/useProjectionHud';
import { GestureStatusRail } from './GestureStatusRail';
import { RecipeHud } from './RecipeHud';
import { RecipeMenu } from './RecipeMenu';
import { StartScreen } from './StartScreen';
import { UtilityStatusPanel } from './UtilityStatusPanel';

export const ProjectionHud: React.FC = () => {
    const hud = useProjectionHud();
    const isCooking = hud.mode === 'cooking';

    return (
        <div className="relative h-full w-full overflow-hidden">
            {hud.mode === 'idle' && (
                <StartScreen
                    isConnected={hud.isConnected}
                    isLoadingRecipes={hud.isLoadingRecipes}
                    recipeError={hud.recipeError}
                    onStart={hud.openMenu}
                />
            )}

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
                />
            )}

            {/* Gesture hints + connection overlay — hidden in cooking mode (integrated into RecipeHud) */}
            {!isCooking && (
                <>
                    <GestureStatusRail
                        mode={hud.mode}
                        lastAction={hud.lastAction}
                    />
                    <UtilityStatusPanel
                        mode={hud.mode}
                        isConnected={hud.isConnected}
                        currentRecipe={hud.currentRecipe}
                        selectedRecipe={hud.selectedRecipe}
                    />
                </>
            )}
        </div>
    );
};
