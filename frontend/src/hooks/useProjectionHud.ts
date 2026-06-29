import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useWebSocket } from '../context/useWebSocket';
import type { GestureAction, Recipe, ServerWebSocketMessage } from '../types/contracts';

export type ProjectionHudMode = 'menu' | 'ingredient_check' | 'cooking';

export interface ProjectionHudViewModel {
    mode: ProjectionHudMode;
    isLoadingRecipes: boolean;
    recipeError: string | null;
    recipes: Recipe[];
    selectedRecipeIndex: number;
    selectedRecipe: Recipe | null;
    currentRecipe: Recipe | null;
    currentStepIndex: number;
    currentStepNumber: number;
    totalSteps: number;
    currentInstruction: string | null;
    progressPercent: number;
    lastAction: GestureAction | null;
    isConnected: boolean;
    openMenu: () => void;
    closeMenu: () => void;
    reset: () => void;
    selectRecipe: (index?: number) => void;
    nextRecipe: () => void;
    previousRecipe: () => void;
    nextStep: () => void;
    previousStep: () => void;
    startCooking: () => void;
}

export function useProjectionHud(): ProjectionHudViewModel {
    const { isConnected, lastMessage } = useWebSocket();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
    const [recipeError, setRecipeError] = useState<string | null>(null);
    const [isAppStarted, setIsAppStarted] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(true);
    const [isIngredientCheck, setIsIngredientCheck] = useState(false);
    const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
    const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const handledMessageRef = useRef<ServerWebSocketMessage | null>(null);

    const lastAction = lastMessage?.type === 'cv_update'
        ? lastMessage.data.action
        : null;

    useEffect(() => {
        let cancelled = false;

        async function loadRecipes() {
            setIsLoadingRecipes(true);
            setRecipeError(null);

            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/recipes/`);

                if (!response.ok) {
                    throw new Error(`Recipe request failed: ${response.status}`);
                }

                const data = await response.json() as Recipe[];
                const nextRecipes = Array.isArray(data) ? data : [];

                if (cancelled) return;

                setRecipes(nextRecipes);
                setSelectedRecipeIndex(index =>
                    nextRecipes.length === 0 ? 0 : Math.min(index, nextRecipes.length - 1)
                );
            } catch (error) {
                if (cancelled) return;
                setRecipeError(error instanceof Error ? error.message : 'Failed to load recipes');
            } finally {
                if (!cancelled) {
                    setIsLoadingRecipes(false);
                }
            }
        }

        void loadRecipes();

        return () => {
            cancelled = true;
        };
    }, []);

    const reset = useCallback(() => {
        setIsMenuOpen(true);
        setIsIngredientCheck(false);
        setCurrentRecipe(null);
        setCurrentStepIndex(0);
        setSelectedRecipeIndex(0);
    }, []);

    const openMenu = useCallback(() => {
        setIsAppStarted(true);
        setIsMenuOpen(true);
        setIsIngredientCheck(false);
    }, []);

    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
    }, []);

    const nextRecipe = useCallback(() => {
        setSelectedRecipeIndex(index => {
            if (recipes.length === 0) return 0;
            return (index + 1) % recipes.length;
        });
    }, [recipes.length]);

    const previousRecipe = useCallback(() => {
        setSelectedRecipeIndex(index => {
            if (recipes.length === 0) return 0;
            return (index - 1 + recipes.length) % recipes.length;
        });
    }, [recipes.length]);

    const selectRecipe = useCallback((index = selectedRecipeIndex) => {
        const selected = recipes[index];
        if (!selected) return;

        setCurrentRecipe(selected);
        setCurrentStepIndex(0);
        setIsAppStarted(true);
        setIsMenuOpen(false);
        setIsIngredientCheck(true);
    }, [recipes, selectedRecipeIndex]);

    const startCooking = useCallback(() => {
        setIsIngredientCheck(false);
    }, []);

    const nextStep = useCallback(() => {
        setCurrentStepIndex(index => {
            if (!currentRecipe) return index;
            return Math.min(index + 1, currentRecipe.instructions.length - 1);
        });
    }, [currentRecipe]);

    const previousStep = useCallback(() => {
        setCurrentStepIndex(index => Math.max(index - 1, 0));
    }, []);

    const handleAction = useCallback((action: GestureAction) => {
        if (action === 'NO_ACTION') return;

        if (action === 'START_APP') {
            openMenu();
            return;
        }

        if (action === 'RESET_APP') {
            reset();
            return;
        }

        if (!isAppStarted) return;

        if (action === 'BACK_TO_MENU') {
            openMenu();
            return;
        }

        if (action === 'MENU_NEXT' && isMenuOpen) {
            nextRecipe();
            return;
        }

        if (action === 'MENU_PREVIOUS' && isMenuOpen) {
            previousRecipe();
            return;
        }

        if (action === 'SELECT_RECIPE' && isMenuOpen) {
            selectRecipe();
            return;
        }

        if (action === 'MENU_CLOSE') {
            closeMenu();
            return;
        }

        // Only advance cooking steps when actually in cooking mode
        if (!currentRecipe || isMenuOpen || isIngredientCheck) return;

        if (action === 'NEXT_STEP') {
            nextStep();
            return;
        }

        if (action === 'PREVIOUS_STEP') {
            previousStep();
        }
    }, [
        closeMenu,
        currentRecipe,
        isAppStarted,
        isIngredientCheck,
        isMenuOpen,
        nextRecipe,
        nextStep,
        openMenu,
        previousRecipe,
        previousStep,
        reset,
        selectRecipe,
    ]);

    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'cv_update' || !lastMessage.data.action) return;
        if (handledMessageRef.current === lastMessage) return;

        handledMessageRef.current = lastMessage;
        handleAction(lastMessage.data.action);
    }, [handleAction, lastMessage]);

    const selectedRecipe = recipes[selectedRecipeIndex] ?? null;
    const totalSteps = currentRecipe?.instructions.length ?? 0;
    const currentStepNumber = currentRecipe ? currentStepIndex + 1 : 0;
    const currentInstruction = currentRecipe?.instructions[currentStepIndex]?.description ?? null;
    const progressPercent = totalSteps > 0 ? (currentStepNumber / totalSteps) * 100 : 0;

    const mode: ProjectionHudMode = useMemo(() => {
        if (isMenuOpen) return 'menu';
        if (isIngredientCheck) return 'ingredient_check';
        return 'cooking';
    }, [isIngredientCheck, isMenuOpen]);

    return {
        mode,
        isLoadingRecipes,
        recipeError,
        recipes,
        selectedRecipeIndex,
        selectedRecipe,
        currentRecipe,
        currentStepIndex,
        currentStepNumber,
        totalSteps,
        currentInstruction,
        progressPercent,
        lastAction,
        isConnected,
        openMenu,
        closeMenu,
        reset,
        selectRecipe,
        nextRecipe,
        previousRecipe,
        nextStep,
        previousStep,
        startCooking,
    };
}
