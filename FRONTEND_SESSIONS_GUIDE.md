# Frontend Sessions Guide — CoCI Projection HUD

This document is the reference for editing Session 1 (Idle/Start) and Session 3 (Cooking HUD) of the CoCI frontend. It covers every file involved, the exact lines to change for common edits, and how the frontend logic flows from gestures to rendered UI.

---

## Full-Screen Layout — How Sizing Works

The entire UI must fill 100% of the viewport. CSS height is **inherited**, not automatic — every level of the parent chain must declare an explicit height, otherwise `h-full` on a child collapses to zero.

### Height chain (must all be set)

```
html                  height: 100%    ← frontend/src/index.css
body                  height: 100%    ← frontend/src/index.css
#root                 height: 100%    ← frontend/src/App.css  (display: flex)
ProjectionLayout      w-screen h-screen  ← uses 100vw / 100vh viewport units
  └─ children wrapper   w-full h-full    ← frontend/src/components/ProjectionLayout.tsx line 40
       └─ ProjectionHud   h-full w-full  ← frontend/src/components/hud/ProjectionHud.tsx
            └─ StartScreen / RecipeMenu / RecipeHud   h-full or min-h-screen
```

If any level in this chain has `height: auto` (the default), every `h-full` below it collapses.

### Files that control layout sizing

| File | What to edit | Effect |
|---|---|---|
| `frontend/src/index.css` | `html, body { height: 100% }` | Root height anchor |
| `frontend/src/App.css` | `#root { height: 100%; display: flex }` | React root fills body |
| `frontend/src/components/ProjectionLayout.tsx` line 14 | `w-screen h-screen` on outer div | Locks to full viewport |
| `frontend/src/components/ProjectionLayout.tsx` line 40 | `w-full h-full` on children wrapper | Passes full height to `ProjectionHud` |
| `frontend/src/components/hud/ProjectionHud.tsx` line 13 | `relative h-full w-full overflow-hidden` | Fills the children wrapper |

### Changing the overall projection canvas size

The projection target is `100vw × 100vh` (full screen). To constrain it to a fixed resolution (e.g. 1366×768 for a specific projector):

`ProjectionLayout.tsx` — line 14
```tsx
// current: fills full viewport
<div className="w-screen h-screen bg-black text-white overflow-hidden relative">

// fixed resolution example:
<div className="w-[1366px] h-[768px] bg-black text-white overflow-hidden relative mx-auto">
```

### Changing the background

`ProjectionLayout.tsx` controls three background layers stacked with `absolute inset-0`:

1. **Camera feed** (line 16–24) — only shows when backend is streaming video:
   ```tsx
   <img className="w-full h-full object-cover opacity-100" />
   ```
   Change `opacity-100` → `opacity-50` to blend camera under HUD.

2. **Scanline grid** (lines 27–36) — the cyan grid texture:
   ```tsx
   backgroundImage: `linear-gradient(to right, #2bdff0 1px, transparent 1px),
                     linear-gradient(to bottom, #2bdff0 1px, transparent 1px)`
   backgroundSize: '52px 52px'
   ```
   - Change `52px 52px` → e.g. `32px 32px` to make the grid denser
   - Change `#2bdff0` to any color
   - Change `opacity-[0.08]` → higher to make grid more visible
   - Remove this entire block to eliminate the scanlines

3. **Vignette** (line 38) — dark radial gradient at edges:
   ```tsx
   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-70" />
   ```
   - Change `opacity-70` to adjust vignette strength
   - Change `black` to another dark color

---

## Architecture Overview

```
App.tsx
└── WebSocketProvider          ← WebSocket connection lifecycle
    └── ProjectionLayout       ← Dark scanline background + camera overlay
        └── ProjectionHud      ← Mode router (idle / menu / cooking)
            ├── StartScreen    ← Session 1: shown when mode === 'idle'
            ├── RecipeMenu     ← Session 2: shown when mode === 'menu'
            ├── RecipeHud      ← Session 3: shown when mode === 'cooking'
            ├── GestureStatusRail   ← Bottom-left gesture hint overlay
            └── UtilityStatusPanel  ← Bottom-right status overlay
```

### How the mode is determined

File: `frontend/src/hooks/useProjectionHud.ts` — lines 220–224

```ts
const mode: ProjectionHudMode = useMemo(() => {
    if (!isAppStarted) return 'idle';     // → StartScreen
    if (isMenuOpen)    return 'menu';     // → RecipeMenu
    return 'cooking';                     // → RecipeHud
}, [isAppStarted, isMenuOpen]);
```

**State variables that control mode:**

| Variable | Type | Set by gesture | Set by code |
|---|---|---|---|
| `isAppStarted` | boolean | `START_APP` → true, `RESET_APP` → false | `openMenu()` sets true |
| `isMenuOpen` | boolean | `BACK_TO_MENU` → true, `SELECT_RECIPE` / `MENU_CLOSE` → false | `openMenu()` / `closeMenu()` |

### Gesture → action → mode mapping

File: `frontend/src/hooks/useProjectionHud.ts` — lines 142–204

```
Backend gesture → WebSocket message → GestureAction string
    → handleAction() in useProjectionHud.ts
        → state update
            → mode changes
                → ProjectionHud renders the matching session
```

Gesture action strings are defined in:
`frontend/src/types/contracts.ts` — lines 35–45

```ts
type GestureAction =
    | 'START_APP'       // idle → menu
    | 'RESET_APP'       // any → idle
    | 'MENU_NEXT'       // cycles selectedRecipeIndex +1
    | 'MENU_PREVIOUS'   // cycles selectedRecipeIndex -1
    | 'MENU_CLOSE'      // closes menu panel
    | 'BACK_TO_MENU'    // cooking → menu
    | 'SELECT_RECIPE'   // menu → cooking (uses current selectedRecipeIndex)
    | 'NEXT_STEP'       // cooking: step +1
    | 'PREVIOUS_STEP'   // cooking: step -1
    | 'NO_ACTION'       // ignored
```

---

## Session 1 — Idle / Start Screen

### What the user sees

- Dark `#030908` background
- Animated 3-ring scanner with rotating dashed ring and glowing dot
- "CHEF_HUD" heading in Sometype Mono
- "INTERACTIVE COOKING SYSTEM v2.4" version label
- Connection status dot (green = connected, red = disconnected)
- "USE BOTH INDEX FINGERS TO START" instruction text
- Manual "Initialize" button (visible when recipes finish loading)

### Primary file

```
frontend/src/components/hud/StartScreen.tsx
```

### Common edits — Session 1

#### Change the main title ("CHEF_HUD")
`StartScreen.tsx` — line 50
```tsx
<h1 className="text-4xl font-bold tracking-widest text-white uppercase">
    CHEF_HUD   ← edit this string
</h1>
```

#### Change the version label
`StartScreen.tsx` — line 53
```tsx
<p className="text-sm tracking-widest text-cyan-300/60 font-mono">
    INTERACTIVE COOKING SYSTEM v2.4   ← edit this string
</p>
```

#### Change the instruction text
`StartScreen.tsx` — line 92
```tsx
<p className="text-xs tracking-widest text-slate-400 max-w-xs mx-auto leading-relaxed font-mono">
    USE BOTH INDEX FINGERS TO START   ← edit this string
</p>
```

#### Change the Initialize button label or style
`StartScreen.tsx` — lines 97–104
```tsx
<motion.button
    onClick={onStart}
    className="px-6 py-3 bg-cyan-500/20 border border-cyan-400 rounded-lg
               text-cyan-300 font-bold tracking-widest uppercase text-sm
               hover:bg-cyan-500/30 transition-colors"
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
>
    Initialize   ← button label
</motion.button>
```

To change the button color: replace `border-cyan-400`, `text-cyan-300`, `bg-cyan-500/20` with your color.

#### Change the scanner ring sizes or speeds
`StartScreen.tsx` — lines 28–44

Three rings:
- **Outer** (140×140): pulsing scale + opacity — `animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}`, duration 3s
- **Middle dashed** (inset-2 from outer): rotating clockwise — `animate={{ rotate: 360 }}`, duration 12s
- **Inner dot pulse**: `animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}`, duration 2s

Change `transition={{ duration: X }}` on each ring to adjust speed.

#### Change the connected / disconnected status color
`StartScreen.tsx` — lines 80–87
```tsx
<motion.div
    className="w-2 h-2 rounded-full"
    style={{
        backgroundColor: isConnected ? '#4DFFB3' : '#FF5A6A',  ← change colors here
    }}
```

#### Conditionally show the Initialize button
`StartScreen.tsx` — line 97

Currently: `{!isLoadingRecipes && (` — button shows as soon as recipes finish loading.
To also require WebSocket connection: `{!isLoadingRecipes && isConnected && (`

### How Session 1 ends

When the user clicks "Initialize" (or the gesture `START_APP` fires):
- `onStart` prop is called → `hud.openMenu()` in `ProjectionHud.tsx` line 19
- `useProjectionHud` sets `isAppStarted = true` and `isMenuOpen = true`
- Mode becomes `'menu'` → `RecipeMenu` renders instead

---

## Session 3 — Cooking HUD

### What the user sees

Three-column layout inside a dark panel:

| Column | Content | File |
|---|---|---|
| Left (≈18vw) | 3 circular timers | `CircularTimer.tsx` |
| Center (flex-1) | Recipe title, step, instruction, stove rings, BACK/NEXT/MENU | `RecipeHud.tsx` |
| Right (≈18vw) | Ingredient grid, utensils, hand status | `RecipeHud.tsx` |

Overlays (on top of everything):
- Bottom-left: gesture hint rail — `GestureStatusRail.tsx`
- Bottom-right: utility status panel — `UtilityStatusPanel.tsx`

### Primary file

```
frontend/src/components/hud/RecipeHud.tsx
```

### Sub-component files

```
frontend/src/components/hud/CircularTimer.tsx
frontend/src/components/hud/ProgressHeader.tsx
frontend/src/components/hud/GestureStatusRail.tsx
frontend/src/components/hud/UtilityStatusPanel.tsx
frontend/src/components/hud/GlassPanel.tsx
```

### Data flowing into Session 3

From `useProjectionHud.ts`, `ProjectionHud.tsx` passes to `RecipeHud`:

```tsx
// ProjectionHud.tsx — lines 36–45
<RecipeHud
    recipe={hud.currentRecipe}        // full Recipe object
    stepNumber={hud.currentStepNumber} // 1-indexed current step
    totalSteps={hud.totalSteps}        // recipe.instructions.length
    instruction={hud.currentInstruction} // instructions[stepIndex].description
    progressPercent={hud.progressPercent} // (stepNumber / totalSteps) * 100
    onNextStep={hud.nextStep}
    onPreviousStep={hud.previousStep}
    onOpenMenu={hud.openMenu}
/>
```

The `Recipe` type is in `frontend/src/types/contracts.ts` — lines 14–26:
```ts
interface Recipe {
    id: string;
    title: string;
    description?: string | null;
    prep_time_minutes?: number | null;
    cook_time_minutes?: number | null;
    servings?: number | null;
    difficulty?: string | null;
    cuisine?: string | null;
    image_url?: string | null;
    ingredients: Ingredient[];     // [{ name, amount, unit, notes }]
    instructions: InstructionStep[]; // [{ step, description, timer_minutes }]
}
```

### Common edits — Session 3

#### Change the center recipe title style
`RecipeHud.tsx` — line 75
```tsx
<h2 className="text-xl font-bold text-white uppercase tracking-wide mb-2">
    {recipe.title}
</h2>
```
Change `text-xl`, `font-bold`, `text-white`, `tracking-wide` to your target style.

#### Change the step counter display
`RecipeHud.tsx` — line 79
```tsx
<p className="text-cyan-300 text-sm font-mono tracking-widest mb-2">
    STEP {stepNumber}/{totalSteps}
</p>
```

#### Change the progress bar colors
`frontend/src/components/hud/ProgressHeader.tsx` — line 27
```tsx
<motion.div
    className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"  ← change gradient
    animate={{ width: `${progressPercent}%` }}
    transition={{ duration: 0.6, ease: 'easeOut' }}
/>
```

#### Change the progress bar track height or color
`ProgressHeader.tsx` — line 25
```tsx
<div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
```
Change `h-2` for thickness, `bg-slate-800` for track color.

#### Change the stove target ring sizes or glow
`RecipeHud.tsx` — lines 88–107

Three concentric rings:
1. **Outer blur glow** (line 88–89): `blur-[60px]` — background ambient glow
2. **Inner blur glow** (line 90–91): `blur-[30px]`
3. **Pulsing outer ring** (lines 92–96): `border-[rgba(0,211,243,0.4)]`, `shadow-[...]`, animated `scale` 0.97↔1.03
4. **Middle ring** (line 98): `border-[rgba(83,234,253,0.3)]`
5. **Dashed inner ring** (lines 100–106): `border-dashed`, contains "STOVE" label

To change the stove ring color, replace `rgba(0,211,243,...)` / `rgba(83,234,253,...)` with your color values.

#### Change the instruction text style
`RecipeHud.tsx` — lines 110–112
```tsx
<p className="text-slate-200 text-sm leading-relaxed text-center max-w-xl font-mono">
    {instruction || 'Follow the recipe step carefully.'}
</p>
```

#### Change BACK / NEXT / MENU button colors
`RecipeHud.tsx` — lines 117–148

- **BACK button** (line 121): `bg-slate-800/50 border-slate-700 text-slate-300`
- **MENU button** (line 128): `bg-purple-500/20 border-purple-400/40 text-purple-300`
- **NEXT button** (line 135): `bg-cyan-500/20 border-cyan-400 text-cyan-300`

#### Change the circular timer ring color or progress
`frontend/src/components/hud/CircularTimer.tsx` — line 22
```tsx
const strokeColor = tone === 'cyan' ? '#3EF7FF' : '#B447FF';
```
Change `#3EF7FF` (cyan timer color) or `#B447FF` (purple timer color).

Timer 1 — step-based progress:
`RecipeHud.tsx` — line 49
```tsx
progress={Math.min(95, 35 + (stepNumber - 1) * 15)}
```

Timer 3 — total cook progress:
`RecipeHud.tsx` — line 63
```tsx
progress={Math.min(100, Math.round(progressPercent))}
```

Timer 2 (purple, boxed):
`RecipeHud.tsx` — lines 52–58 — currently static at 75% progress.

#### Change the ingredient grid (right column)
`RecipeHud.tsx` — lines 153–175

Shows first 9 ingredients in a 3×3 grid. To show more: change `slice(0, 9)` on line 161.
To change grid columns: change `grid-cols-3` on line 160.
Each cell style on line 163: `bg-slate-800/50 border-slate-700 rounded-lg`

#### Change the utensils list (right column)
`RecipeHud.tsx` — lines 177–191

Currently hardcoded: `['Skillet', 'Spatula', 'Timer']` on line 185.
Replace with dynamic recipe data if your Recipe type includes utensils.

#### Change the gesture hints (bottom-left overlay)
`frontend/src/components/hud/GestureStatusRail.tsx` — lines 10–24

```tsx
const gestureHints: Record<ProjectionHudMode, { gesture: string; action: string }[]> = {
    idle: [
        { gesture: 'Both index fingers', action: 'START' },
    ],
    menu: [
        { gesture: 'Left/Right index', action: 'NAVIGATE' },
        { gesture: 'Closed fist', action: 'SELECT' },
        { gesture: 'Open palm', action: 'BACK' },
    ],
    cooking: [
        { gesture: 'Right index', action: 'NEXT STEP' },   ← edit here
        { gesture: 'Left index', action: 'PREV STEP' },
        { gesture: 'Closed fist', action: 'MENU' },
    ],
};
```

#### Change the utility panel (bottom-right overlay)
`frontend/src/components/hud/UtilityStatusPanel.tsx`

- **Connection dot colors** (line 31): `'#4DFFB3'` (connected) / `'#FF5A6A'` (disconnected)
- **Cooking mode info** (lines 42–85): shows recipe title, first 3 ingredients, prep/cook times
- **Panel width** (line 24): `w-64` — change to adjust width

### How steps advance in Session 3

Step navigation in `useProjectionHud.ts`:

```
NEXT_STEP gesture → handleAction() line 184 → nextStep()
    → setCurrentStepIndex(Math.min(index + 1, instructions.length - 1))
    → currentStepNumber = currentStepIndex + 1  (line 216)
    → currentInstruction = instructions[currentStepIndex].description  (line 217)
    → progressPercent = (currentStepNumber / totalSteps) * 100  (line 218)
    → RecipeHud re-renders with new step data
```

Manual click: "NEXT" button in `RecipeHud.tsx` line 139 calls `onNextStep` → same path above.

### How Session 3 ends

- **MENU button click** (or `BACK_TO_MENU` gesture): calls `onOpenMenu()` → `hud.openMenu()` → `isMenuOpen = true` → mode becomes `'menu'`
- **`RESET_APP` gesture**: resets everything → mode becomes `'idle'`

---

## Recipe data flow (both sessions)

Recipes are fetched once on mount inside `useProjectionHud.ts` — lines 50–88:

```
Component mounts
→ fetch(`${API_BASE_URL}/api/v1/recipes/`)   ← API_BASE_URL in frontend/src/config.ts
    → setRecipes(data)
    → isLoadingRecipes = false
    → UI unblocks
```

If the backend is not running, `recipeError` is set and shown in `StartScreen`.
The API endpoint: `GET /api/v1/recipes/` → backend `backend/app/api/v1/endpoints/`

Recipe JSON files (source of truth):
```
data/recipes/*.json
```
Each file maps directly to the `Recipe` interface in `contracts.ts`.

---

## File reference summary

| File | Session | Purpose |
|---|---|---|
| `frontend/src/index.css` | All | `html, body { height: 100% }` — root height anchor |
| `frontend/src/App.css` | All | `#root { height: 100%; display: flex }` — React root sizing |
| `frontend/src/components/ProjectionLayout.tsx` | All | Full-screen wrapper: `w-screen h-screen`, scanline grid, vignette, camera feed |
| `frontend/src/hooks/useProjectionHud.ts` | All | State machine: mode, step, recipe selection |
| `frontend/src/components/hud/ProjectionHud.tsx` | All | Mode router — renders the right session, `h-full w-full` |
| `frontend/src/components/hud/StartScreen.tsx` | 1 | Idle screen: scanner ring, centered with `flex items-center justify-center h-full` |
| `frontend/src/components/hud/RecipeHud.tsx` | 3 | Cooking HUD: 3-column `flex h-full w-full` layout |
| `frontend/src/components/hud/CircularTimer.tsx` | 3 | Left column circular timer rings with `clamp()` sizing |
| `frontend/src/components/hud/ProgressHeader.tsx` | 3 | Progress bar in center column header |
| `frontend/src/components/hud/GestureStatusRail.tsx` | All | Bottom-left gesture hint overlay (`fixed bottom-4 left-4`) |
| `frontend/src/components/hud/UtilityStatusPanel.tsx` | 2+3 | Bottom-right status overlay (`fixed bottom-4 right-4 w-64`) |
| `frontend/src/components/hud/GlassPanel.tsx` | 3 | Reusable glass card: bg/border/blur/radius |
| `frontend/src/types/contracts.ts` | All | TypeScript types: Recipe, GestureAction, WebSocket messages |
| `frontend/src/config.ts` | All | `API_BASE_URL` — backend address |
| `frontend/src/context/WebSocketProvider.tsx` | All | WebSocket connection + reconnect logic |
| `frontend/index.html` | All | Font imports: Space Mono, Sometype Mono |

---

---

## Container Sizing Reference

### Session 1 — StartScreen container

`StartScreen.tsx` — line 18
```tsx
<div className="flex items-center justify-center h-full w-full">
```
- `h-full w-full` — fills the entire ProjectionHud area (which fills the full screen)
- `flex items-center justify-center` — centers all content vertically and horizontally
- To push content upward: change `items-center` → `items-start` and add `pt-24`
- To push content to a corner: replace with `items-end justify-end p-12`

The inner motion container:
`StartScreen.tsx` — line 19
```tsx
<motion.div className="text-center space-y-8">
```
- `space-y-8` controls vertical gap between all elements (scanner ring, title, status, button)
- Change to `space-y-4` to tighten, `space-y-12` to spread

Scanner ring size: `size-40` (line 27) = 160×160px. To make it larger: `size-56` (224px), `size-64` (256px).

---

### Session 3 — RecipeHud container layout

`RecipeHud.tsx` — line 38
```tsx
<div className="flex h-full w-full p-6 gap-6">
```
- `p-6` — outer padding around all 3 columns. Change to `p-4` for tighter, `p-8` for more breathing room
- `gap-6` — gap between columns. Change to `gap-4` or `gap-8`
- `h-full w-full` — must stay for full-screen fill

**Left column (timers) width:**
`RecipeHud.tsx` — line 40
```tsx
<GlassPanel className="... w-[clamp(180px,18vw,220px)] shrink-0">
```
- `clamp(180px, 18vw, 220px)` — min 180px, scales with viewport, max 220px
- To make the timer column wider: `w-[clamp(200px,22vw,260px)]`
- To make it narrower: `w-[clamp(160px,15vw,190px)]`

**Right column (ingredients/status) width:**
`RecipeHud.tsx` — line 152
```tsx
<GlassPanel className="... w-[clamp(180px,18vw,220px)] shrink-0 overflow-y-auto">
```
- Same clamp values as left column — change both together to keep symmetry

**Center column:**
Takes remaining space via `flex-1` (line 69). No width needed — it fills whatever the left and right columns leave.

**Center column internal layout:**

| Section | Lines | Class controlling size |
|---|---|---|
| Header (recipe title + progress) | 70–82 | `px-6 py-4` padding |
| Stove rings area | 85–108 | `h-64` fixed height |
| Instruction text area | 85 | `flex-1` fills remaining center height |
| Footer (BACK/NEXT/MENU) | 116–149 | `px-6 py-4` padding |

**Stove target rings — changing the size:**
`RecipeHud.tsx` — lines 88–107

The rings use `clamp()` to scale with viewport width:
```tsx
// Outer pulsing ring (line 92-96):
style={{ width: 'clamp(120px, 18vw, 224px)', height: 'clamp(120px, 18vw, 224px)' }}

// Middle ring (line 98):
style={{ width: 'clamp(90px, 14vw, 176px)', height: 'clamp(90px, 14vw, 176px)' }}

// Inner dashed ring (line 100):
style={{ width: 'clamp(65px, 10vw, 126px)', height: 'clamp(65px, 10vw, 126px)' }}
```
Increase all three `clamp()` values proportionally to make the stove target bigger.

The blur glow behind the rings (lines 88–91):
```tsx
// Outer glow:
className="... size-[clamp(180px,26vw,340px)]"
// Inner glow:
className="... size-[clamp(150px,22vw,284px)]"
```
These should be larger than the rings. Increase together with the ring sizes.

**GlassPanel base style:**
`GlassPanel.tsx` — lines 11–17
```tsx
className={`
    bg-slate-950/60          ← glass fill color + opacity
    border border-cyan-300/40 ← border color + opacity
    backdrop-blur-xl          ← blur strength
    rounded-[14px]            ← corner radius
    ${className}
`}
```
Change `bg-slate-950/60` → `bg-slate-900/80` for darker panels.
Change `border-cyan-300/40` → `border-cyan-400/60` for more visible borders.
Change `rounded-[14px]` → `rounded-[24px]` for more rounded corners.
Change `backdrop-blur-xl` → `backdrop-blur-2xl` for stronger blur.

---

## Dev server

Start frontend only (no backend needed for visual testing):
```powershell
cd frontend
npm run dev
```
Open: `http://localhost:5173` (or `5174` if 5173 is in use — Vite prints the actual port).

Start backend (needed for real recipe data):
```powershell
cd backend
uvicorn app.main:app --reload
```

Full stack: start both. The frontend will fetch recipes automatically and connect to WebSocket at the URL set in `frontend/src/config.ts`.
