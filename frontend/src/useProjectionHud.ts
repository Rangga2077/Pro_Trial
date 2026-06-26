import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from './config';
import { useWebSocket } from './context/useWebSocket';
import type { GestureAction, Recipe, ServerWebSocketMessage } from './types/contracts';

export type ProjectionHudMode = 'idle' | 'menu' | 'cooking';

export interface ProjectionHudViewModel {
    mode: ProjectionHudMode;
    isLoadingRecipes: boolean;
    recipeError: string | null;
    recipes: Recipe[];
    selectedRecipeIndex: number;
    selectedRecipe: Recipe | null;
    currentRecipe: Recipe | null;
    currentStepIndex: number;
    currentStepDescription: string | null;
    currentStepTimerMinutes: number | null;
    totalSteps: number;
    progressPercent: number;
    lastAction: GestureAction | null;
    startApp: () => void;
    resetApp: () => void;
    openMenu: () => void;
    closeMenu: () => void;
    selectRecipe: (index: number) => void;
    nextStep: () => void;
    previousStep: () => void;
}

export function useProjectionHud(): ProjectionHudViewModel {
    const { lastMessage } = useWebSocket();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isAppStarted, setIsAppStarted] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
    const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
    const [recipeError, setRecipeError] = useState<string | null>(null);

    const handledMessageRef = useRef<ServerWebSocketMessage | null>(null);
    const lastAction = lastMessage?.type === 'cv_update' ? lastMessage.data.action : null;

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/v1/recipes/`)
            .then(res => {
                if (!res.ok) throw new Error(`Recipe API returned ${res.status}`);
                return res.json();
            })
            .then((data: Recipe[]) => {
                const nextRecipes = Array.isArray(data) ? data : [];
                setRecipes(nextRecipes);
                setSelectedRecipeIndex(index => nextRecipes.length === 0 ? 0 : Math.min(index, nextRecipes.length - 1));
                setRecipeError(null);
            })
            .catch(err => {
                console.error('Error fetching recipes:', err);
                setRecipeError('Recipe service offline');
                setRecipes([]);
                setSelectedRecipeIndex(0);
            })
            .finally(() => setIsLoadingRecipes(false));
    }, []);

    const resetApp = useCallback(() => {
        setIsAppStarted(false);
        setIsMenuOpen(false);
        setCurrentRecipe(null);
        setCurrentStepIndex(0);
        setSelectedRecipeIndex(0);
    }, []);

    const startApp = useCallback(() => {
        setIsAppStarted(true);
        setIsMenuOpen(true);
    }, []);

    const openMenu = useCallback(() => {
        if (!isAppStarted) setIsAppStarted(true);
        setIsMenuOpen(true);
    }, [isAppStarted]);

    const closeMenu = useCallback(() => setIsMenuOpen(false), []);

    const selectRecipe = useCallback((index: number) => {
        const selected = recipes[index];
        if (!selected) return;

        setSelectedRecipeIndex(index);
        setCurrentRecipe(selected);
        setCurrentStepIndex(0);
        setIsAppStarted(true);
        setIsMenuOpen(false);
    }, [recipes]);

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
            startApp();
            return;
        }

        if (action === 'RESET_APP') {
            resetApp();
            return;
        }

        if (!isAppStarted) return;

        if (action === 'BACK_TO_MENU') {
            setIsMenuOpen(true);
            return;
        }

        if (action === 'MENU_NEXT' && isMenuOpen && recipes.length > 0) {
            setSelectedRecipeIndex(index => (index + 1) % recipes.length);
            return;
        }

        if (action === 'MENU_PREVIOUS' && isMenuOpen && recipes.length > 0) {
            setSelectedRecipeIndex(index => (index - 1 + recipes.length) % recipes.length);
            return;
        }

        if (action === 'SELECT_RECIPE' && isMenuOpen) {
            selectRecipe(selectedRecipeIndex);
            return;
        }

        if (action === 'MENU_CLOSE') {
            setIsMenuOpen(false);
            return;
        }

        if (!currentRecipe || isMenuOpen) return;

        if (action === 'NEXT_STEP') {
            nextStep();
            return;
        }

        if (action === 'PREVIOUS_STEP') {
            previousStep();
        }
    }, [
        currentRecipe,
        isAppStarted,
        isMenuOpen,
        nextStep,
        previousStep,
        recipes.length,
        resetApp,
        selectRecipe,
        selectedRecipeIndex,
        startApp,
    ]);

    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'cv_update' || !lastMessage.data.action) return;
        if (handledMessageRef.current === lastMessage) return;

        handledMessageRef.current = lastMessage;
        // WebSocket messages are external events; this dispatch intentionally updates UI state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        handleAction(lastMessage.data.action);
    }, [handleAction, lastMessage]);

    return useMemo(() => {
        const selectedRecipe = recipes[selectedRecipeIndex] ?? null;
        const totalSteps = currentRecipe?.instructions.length ?? 0;
        const currentStep = currentRecipe?.instructions[currentStepIndex] ?? null;
        const mode: ProjectionHudMode = !isAppStarted ? 'idle' : isMenuOpen ? 'menu' : 'cooking';
        const progressPercent = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

        return {
            mode,
            isLoadingRecipes,
            recipeError,
            recipes,
            selectedRecipeIndex,
            selectedRecipe,
            currentRecipe,
            currentStepIndex,
            currentStepDescription: currentStep?.description ?? null,
            currentStepTimerMinutes: currentStep?.timer_minutes ?? null,
            totalSteps,
            progressPercent,
            lastAction,
            startApp,
            resetApp,
            openMenu,
            closeMenu,
            selectRecipe,
            nextStep,
            previousStep,
        };
    }, [
        closeMenu,
        currentRecipe,
        currentStepIndex,
        isAppStarted,
        isLoadingRecipes,
        isMenuOpen,
        lastAction,
        nextStep,
        openMenu,
        previousStep,
        recipeError,
        recipes,
        resetApp,
        selectRecipe,
        selectedRecipeIndex,
        startApp,
    ]);
}
