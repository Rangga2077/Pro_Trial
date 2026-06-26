# CoCI Figma-To-Frontend Hook Guide

This guide is the single handoff file for designing the CoCI projection UI skeleton in Figma, then wiring that design to the React frontend.

Use it with the existing Figma starter doc:

```text
docs/FIGMA_COCI_PROJECTION_HUD.md
docs/coci_projection_hud_skeleton.svg
```

The main idea is simple: keep Figma responsible for layout and component structure, keep React responsible for rendering those components, and keep all camera, CV, gesture interpretation, recipe APIs, and WebSocket contracts in the existing backend/frontend boundary.

## Target Frontend Shape

Create a design-facing hook that turns app, recipe, and gesture state into a clean view model:

```text
frontend/src/hooks/useProjectionHud.ts
```

Then build Figma-mapped UI components around that hook:

```text
frontend/src/components/hud/GlassPanel.tsx
frontend/src/components/hud/CircularTimer.tsx
frontend/src/components/hud/ProgressHeader.tsx
frontend/src/components/hud/RecipeHud.tsx
frontend/src/components/hud/RecipeMenu.tsx
frontend/src/components/hud/UtilityStatusPanel.tsx
frontend/src/components/hud/GestureStatusRail.tsx
frontend/src/components/hud/StartScreen.tsx
frontend/src/components/hud/ProjectionHud.tsx
```

`ProjectionHud.tsx` should replace the UI responsibility currently concentrated in `RecipeManager.tsx`. Keep `ProjectionLayout.tsx`, `OverlayCanvas.tsx`, `DisplaySettings.tsx`, `VoiceStatus.tsx`, and `WebSocketProvider` in place unless the design specifically needs them moved.

## Figma Naming Rules

Name Figma components to match React components. This makes wiring much easier:

```text
GlassPanel
CircularTimer
ProgressHeader
RecipeHud
RecipeMenu
UtilityStatusPanel
GestureStatusRail
StartScreen
ProjectionHud
```

Recommended Figma pages:

```text
00 Cover
01 Foundations
02 Components
03 Screens
04 Prototype Flow
```

Recommended screen frame:

```text
Desktop Projection / 1366 x 768
```

Keep component names stable. If a Figma component is called `RecipeHud`, the React component should also be `RecipeHud`.

## State Ownership

Do this:

```text
Backend:
- Camera access
- CV pipeline
- MediaPipe gesture reading
- Gesture action interpretation
- Recipe API
- WebSocket broadcast payloads

Frontend hook:
- Fetch available recipes
- Track selected recipe
- Track current recipe step
- Translate backend GestureAction values into frontend UI state changes
- Expose display-ready view state

Frontend components:
- Render the HUD
- Render recipe menu
- Render status panels
- Render gesture hints
- Render loading/error/empty states
```

Do not make React interpret raw MediaPipe gestures. React should only respond to backend-owned `GestureAction` values from `frontend/src/types/contracts.ts`.

## Hook File Skeleton

Create this file:

```text
frontend/src/hooks/useProjectionHud.ts
```

Skeleton:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useWebSocket } from '../context/useWebSocket';
import type { GestureAction, Recipe, ServerWebSocketMessage } from '../types/contracts';

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
}

export function useProjectionHud(): ProjectionHudViewModel {
    const { isConnected, lastMessage } = useWebSocket();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
    const [recipeError, setRecipeError] = useState<string | null>(null);
    const [isAppStarted, setIsAppStarted] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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
        setIsAppStarted(false);
        setIsMenuOpen(false);
        setCurrentRecipe(null);
        setCurrentStepIndex(0);
        setSelectedRecipeIndex(0);
    }, []);

    const openMenu = useCallback(() => {
        setIsAppStarted(true);
        setIsMenuOpen(true);
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
    }, [recipes, selectedRecipeIndex]);

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

        if (!currentRecipe || isMenuOpen) return;

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
        if (!isAppStarted) return 'idle';
        if (isMenuOpen) return 'menu';
        return 'cooking';
    }, [isAppStarted, isMenuOpen]);

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
    };
}
```

## Component Wiring Skeleton

Create this file:

```text
frontend/src/components/hud/ProjectionHud.tsx
```

Skeleton:

```tsx
import React from 'react';
import { useProjectionHud } from '../../hooks/useProjectionHud';
import { GestureStatusRail } from './GestureStatusRail';
import { RecipeHud } from './RecipeHud';
import { RecipeMenu } from './RecipeMenu';
import { StartScreen } from './StartScreen';
import { UtilityStatusPanel } from './UtilityStatusPanel';

export const ProjectionHud: React.FC = () => {
    const hud = useProjectionHud();

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

            {hud.mode === 'cooking' && hud.currentRecipe && (
                <RecipeHud
                    recipe={hud.currentRecipe}
                    stepNumber={hud.currentStepNumber}
                    totalSteps={hud.totalSteps}
                    instruction={hud.currentInstruction}
                    progressPercent={hud.progressPercent}
                    onNextStep={hud.nextStep}
                    onPreviousStep={hud.previousStep}
                    onOpenMenu={hud.openMenu}
                />
            )}

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
        </div>
    );
};
```

Then update `frontend/src/App.tsx`:

```tsx
import './App.css';
import { WebSocketProvider } from './context/WebSocketProvider';
import { ProjectionLayout } from './components/ProjectionLayout';
import { OverlayCanvas } from './components/OverlayCanvas';
import { VoiceStatus } from './components/VoiceStatus';
import { DisplaySettings } from './components/DisplaySettings';
import { ProjectionHud } from './components/hud/ProjectionHud';

function App() {
    return (
        <WebSocketProvider>
            <DisplaySettings />
            <ProjectionLayout>
                <ProjectionHud />
                <OverlayCanvas />
                <VoiceStatus isListening={true} isProcessing={false} />
            </ProjectionLayout>
        </WebSocketProvider>
    );
}

export default App;
```

Keep `StatusIndicator` only if you still want a debug badge. In the final projection design, connection state should probably live inside `UtilityStatusPanel`.

## Minimal Component Contracts

Use these prop shapes to keep components dumb and easy to match to Figma.

```tsx
// GlassPanel.tsx
export interface GlassPanelProps {
    children: React.ReactNode;
    className?: string;
}
```

```tsx
// ProgressHeader.tsx
export interface ProgressHeaderProps {
    stepNumber: number;
    totalSteps: number;
    progressPercent: number;
}
```

```tsx
// RecipeHud.tsx
import type { Recipe } from '../../types/contracts';

export interface RecipeHudProps {
    recipe: Recipe;
    stepNumber: number;
    totalSteps: number;
    instruction: string | null;
    progressPercent: number;
    onNextStep: () => void;
    onPreviousStep: () => void;
    onOpenMenu: () => void;
}
```

```tsx
// RecipeMenu.tsx
import type { Recipe } from '../../types/contracts';

export interface RecipeMenuProps {
    recipes: Recipe[];
    selectedIndex: number;
    isLoading: boolean;
    error: string | null;
    onSelect: (index?: number) => void;
    onNext: () => void;
    onPrevious: () => void;
    onClose: () => void;
}
```

```tsx
// GestureStatusRail.tsx
import type { GestureAction } from '../../types/contracts';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';

export interface GestureStatusRailProps {
    mode: ProjectionHudMode;
    lastAction: GestureAction | null;
}
```

```tsx
// UtilityStatusPanel.tsx
import type { Recipe } from '../../types/contracts';
import type { ProjectionHudMode } from '../../hooks/useProjectionHud';

export interface UtilityStatusPanelProps {
    mode: ProjectionHudMode;
    isConnected: boolean;
    currentRecipe: Recipe | null;
    selectedRecipe: Recipe | null;
}
```

## Figma-To-Code Mapping

Use this mapping while rebuilding the design:

```text
Figma frame: Desktop Projection / 1366 x 768
React owner: ProjectionLayout + ProjectionHud

Figma component: GlassPanel
React file: frontend/src/components/hud/GlassPanel.tsx
Purpose: Reusable translucent HUD panel.

Figma component: RecipeHud
React file: frontend/src/components/hud/RecipeHud.tsx
Purpose: Main cooking instruction view.

Figma component: RecipeMenu
React file: frontend/src/components/hud/RecipeMenu.tsx
Purpose: Recipe selection overlay.

Figma component: ProgressHeader
React file: frontend/src/components/hud/ProgressHeader.tsx
Purpose: Step count and progress bar.

Figma component: CircularTimer
React file: frontend/src/components/hud/CircularTimer.tsx
Purpose: Timer visual. Start with static props; wire real timer behavior later.

Figma component: GestureStatusRail
React file: frontend/src/components/hud/GestureStatusRail.tsx
Purpose: Small contextual gesture hints and last backend action.

Figma component: UtilityStatusPanel
React file: frontend/src/components/hud/UtilityStatusPanel.tsx
Purpose: Connection, recipe metadata, ingredients, tools, and system status.
```

## Styling Guidance

Use Tailwind classes first. Keep CSS custom rules minimal and only add them when Tailwind becomes awkward.

Suggested token-to-class mapping:

```text
Glass fill: bg-slate-950/60
Glass border: border border-cyan-300/40
Glass blur: backdrop-blur-xl
HUD cyan text: text-cyan-200
HUD cyan strong: text-cyan-300
Muted text: text-slate-300
Primary text: text-white
Warning: text-rose-300 / border-rose-300/40
Active: text-emerald-300 / border-emerald-300/40
Panel radius: rounded-2xl or rounded-[14px]
Button radius: rounded-lg
```

Keep the projection UI high contrast and stable:

```text
- Use fixed rails/panels for HUD structure.
- Avoid layout shifts when recipe titles or instructions change.
- Keep touch-like controls large, even if gestures trigger them.
- Do not put cards inside cards.
- Keep camera overlay alignment stable.
- Use the existing dark projection background from ProjectionLayout.
```

The project does not currently include `lucide-react`. If you need icons, either add that dependency intentionally or design the first version with text/status shapes only.

## Build Order

Follow this order to avoid tangled state:

```text
1. Finish the Figma screen skeleton.
2. Name Figma components using the React component names above.
3. Add frontend/src/hooks/useProjectionHud.ts.
4. Add empty HUD components with typed props.
5. Wire ProjectionHud into App.tsx.
6. Move current RecipeManager behavior into the hook/component split.
7. Style components to match Figma.
8. Run frontend checks.
```

Recommended frontend checks:

```powershell
cd frontend
npm run build
npm run lint
```

## What Not To Change Yet

Avoid changing these unless the task explicitly requires it:

```text
- backend/app/schemas/contracts.py
- frontend/src/types/contracts.ts
- docs/API_Contracts.md
- backend gesture interpretation
- recipe JSON format
- WebSocket payload shapes
```

If you add a new WebSocket action or change payload shape later, update backend Pydantic contracts, frontend TypeScript contracts, API docs, and tests together.

## Manual Wiring Checklist

Use this when you start implementing:

```text
[ ] Figma frame uses 1366 x 768 projection target.
[ ] Figma component names match React component names.
[ ] useProjectionHud.ts compiles.
[ ] ProjectionHud renders idle, menu, and cooking modes.
[ ] GestureAction values still come only from backend WebSocket messages.
[ ] Recipe loading handles loading, empty, and error states.
[ ] Recipe menu selection stays visible while navigating.
[ ] Current step cannot go below 1 or past the final instruction.
[ ] Connection state is visible in the HUD.
[ ] Frontend build passes.
[ ] Frontend lint passes, or known issues are documented.
```

## First Practical Implementation Goal

For the first coded pass, do not chase every visual detail. Aim for this:

```text
- Idle screen starts the experience.
- Menu screen lists recipes and highlights the selected recipe.
- Cooking screen shows title, step number, instruction, and progress.
- Right panel shows connection and current recipe metadata.
- Gesture rail shows available actions for the current mode.
- Existing backend gestures still drive the app through WebSocket messages.
```

Once that works, polish spacing, glass styling, timer visuals, and transitions against the Figma file.
