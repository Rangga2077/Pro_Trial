import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playSfx, preloadSfx, startMusic, stopMusic } from '../audio/sfx';
import { API_BASE_URL } from '../config';
import { useWebSocket } from '../context/useWebSocket';
import type {
    GestureAction,
    Recipe,
    ServerWebSocketMessage,
    VoiceCommandMessage,
    VoiceState,
} from '../types/contracts';

const RECIPE_RETRY_BASE_MS = 1000;
const RECIPE_RETRY_MAX_MS = 5000;

export type ProjectionHudMode = 'menu' | 'ingredient_check' | 'cooking';
export type ThemeMode = 'light' | 'dark';

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
    /** Most recent recognized voice command; screens react to the actions they own (timers, read step). */
    voiceCommand: VoiceCommandMessage | null;
    voiceState: VoiceState;
    isConnected: boolean;
    theme: ThemeMode;
    openMenu: () => void;
    closeMenu: () => void;
    reset: () => void;
    selectRecipe: (index?: number) => void;
    nextRecipe: () => void;
    previousRecipe: () => void;
    nextStep: () => void;
    previousStep: () => void;
    startCooking: () => void;
    toggleTheme: () => void;
}

export function useProjectionHud(): ProjectionHudViewModel {
    const { isConnected, lastMessage, lastVoiceCommand, voiceStatus, sendMessage } = useWebSocket();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
    const [recipeError, setRecipeError] = useState<string | null>(null);
    const [isAppStarted, setIsAppStarted] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(true);
    const [isIngredientCheck, setIsIngredientCheck] = useState(false);
    const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
    const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [theme, setTheme] = useState<ThemeMode>('light');

    const handledMessageRef = useRef<ServerWebSocketMessage | null>(null);
    const handledVoiceRef = useRef<VoiceCommandMessage | null>(null);

    const lastAction = lastMessage?.type === 'cv_update'
        ? lastMessage.data.action
        : null;

    // Load recipes, retrying until the backend answers: on a cold start the
    // window can open before the backend has finished loading its models.
    useEffect(() => {
        let cancelled = false;
        let retryTimer: number | undefined;
        let retryDelay = RECIPE_RETRY_BASE_MS;

        async function loadRecipes() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/recipes/`);

                if (!response.ok) {
                    throw new Error(`Recipe request failed: ${response.status}`);
                }

                const data = await response.json() as Recipe[];
                const nextRecipes = Array.isArray(data) ? data : [];

                if (cancelled) return;

                setRecipes(nextRecipes);
                setRecipeError(null);
                setSelectedRecipeIndex(index =>
                    nextRecipes.length === 0 ? 0 : Math.min(index, nextRecipes.length - 1)
                );
            } catch (error) {
                if (cancelled) return;
                const reason = error instanceof Error ? error.message : 'Failed to load recipes';
                console.warn(`Recipe load failed (${reason}); retrying in ${retryDelay} ms`);
                setRecipeError(`Waiting for the backend at ${API_BASE_URL} (${reason}). Retrying…`);
                retryTimer = window.setTimeout(loadRecipes, retryDelay);
                retryDelay = Math.min(retryDelay * 1.5, RECIPE_RETRY_MAX_MS);
            } finally {
                if (!cancelled) {
                    setIsLoadingRecipes(false);
                }
            }
        }

        void loadRecipes();

        return () => {
            cancelled = true;
            window.clearTimeout(retryTimer);
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

        playSfx('select');
        setCurrentRecipe(selected);
        setCurrentStepIndex(0);
        setIsAppStarted(true);
        setIsMenuOpen(false);
        setIsIngredientCheck(true);
    }, [recipes, selectedRecipeIndex]);

    const startCooking = useCallback(() => {
        setIsIngredientCheck(false);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(current => (current === 'light' ? 'dark' : 'light'));
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

        if (action === 'TOGGLE_THEME') {
            if (!isMenuOpen) toggleTheme();
            return;
        }

        // Voice "black" / "white" set the theme explicitly (the menu has no theme).
        if (action === 'THEME_DARK' || action === 'THEME_LIGHT') {
            if (!isMenuOpen) setTheme(action === 'THEME_DARK' ? 'dark' : 'light');
            return;
        }

        // Session 2 → 3: closed fist or voice "let's cook".
        if (action === 'CONFIRM_READY') {
            if (!isMenuOpen && isIngredientCheck) startCooking();
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
        startCooking,
        toggleTheme,
    ]);

    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'cv_update' || !lastMessage.data.action) return;
        if (handledMessageRef.current === lastMessage) return;

        handledMessageRef.current = lastMessage;
        handleAction(lastMessage.data.action);
    }, [handleAction, lastMessage]);

    // Voice commands share the gesture action handler. The backend already
    // mapped the phrase for the current screen (see the ui_mode effect below).
    // Screen-owned actions (CHECK_INGREDIENT, timers, READ_STEP) are no-ops
    // here; IngredientCheck and RecipeHud handle them.
    useEffect(() => {
        if (!lastVoiceCommand || handledVoiceRef.current === lastVoiceCommand) return;
        handledVoiceRef.current = lastVoiceCommand;

        // Don't let the read-aloud step trigger commands through the mic.
        if (window.speechSynthesis?.speaking) return;

        handleAction(lastVoiceCommand.data.action);
    }, [handleAction, lastVoiceCommand]);

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

    // Tell the backend which screen is showing (and again after reconnects)
    // so "next" means next recipe on the menu but next step while cooking,
    // plus the open recipe, which Jenny answers about.
    const currentRecipeId = currentRecipe?.id ?? null;
    useEffect(() => {
        if (isConnected) sendMessage({ type: 'ui_mode', mode, recipe_id: currentRecipeId });
    }, [currentRecipeId, isConnected, mode, sendMessage]);

    /* ── Sound ─────────────────────────────────────────────────────── */
    useEffect(() => {
        preloadSfx();
        return stopMusic;
    }, []);

    // One click per carousel move, whatever moved it (arrow, gesture, voice).
    const soundTrackRef = useRef({ mode, selectedRecipeIndex });
    useEffect(() => {
        const previous = soundTrackRef.current;
        soundTrackRef.current = { mode, selectedRecipeIndex };
        if (mode === 'menu' && previous.mode === 'menu' && previous.selectedRecipeIndex !== selectedRecipeIndex) {
            playSfx('carousel');
        }
        if (previous.mode !== mode) playSfx('transition');
    }, [mode, selectedRecipeIndex]);

    // Background music loops from Ingredient Check through Cooking.
    useEffect(() => {
        if (mode === 'menu') stopMusic(); else startMusic();
    }, [mode]);

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
        voiceCommand: lastVoiceCommand,
        voiceState: voiceStatus.state,
        isConnected,
        theme,
        toggleTheme,
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
