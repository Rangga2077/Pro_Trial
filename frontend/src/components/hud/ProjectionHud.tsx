import React from 'react';
import { useProjectionHud } from '../../hooks/useProjectionHud';
import { GestureStatusRail } from './GestureStatusRail';
import { IngredientCheck } from './IngredientCheck';
import { RecipeHud } from './RecipeHud';
import { RecipeMenu } from './RecipeMenu';
import { UtilityStatusPanel } from './UtilityStatusPanel';

export const ProjectionHud: React.FC = () => {
    const hud = useProjectionHud();
    const isCooking = hud.mode === 'cooking';
    const isIngredientCheck = hud.mode === 'ingredient_check';

    return (
        <div className="relative h-full w-full overflow-hidden">
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
