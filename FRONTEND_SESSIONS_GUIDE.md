# Frontend Sessions Guide — CoCI Projection HUD

Complete reference for editing all three cooking HUD sessions.
Updated to reflect Sessions 1, 2, and 3 after the Figma light-theme implementation.

---

## App Flow

```
idle  ──►  menu  ──►  ingredient_check  ──►  cooking
 S1     (RecipeMenu)        S2                  S3
```

| Mode | Session | Component | File |
|---|---|---|---|
| `idle` | 1 | `StartScreen` | `frontend/src/components/hud/StartScreen.tsx` |
| `menu` | — | `RecipeMenu` | `frontend/src/components/hud/RecipeMenu.tsx` |
| `ingredient_check` | 2 | `IngredientCheck` | `frontend/src/components/hud/IngredientCheck.tsx` |
| `cooking` | 3 | `RecipeHud` | `frontend/src/components/hud/RecipeHud.tsx` |

Routing lives in:
- `frontend/src/hooks/useProjectionHud.ts` — state machine + gesture dispatch
- `frontend/src/components/hud/ProjectionHud.tsx` — conditional rendering

---

## Architecture Overview

```
App.tsx
└── WebSocketProvider           ← WebSocket connection lifecycle
    └── ProjectionLayout        ← Dark scanline background + camera overlay
        └── ProjectionHud       ← Mode router
            ├── StartScreen         ← mode === 'idle'         (Session 1)
            ├── RecipeMenu          ← mode === 'menu'
            ├── IngredientCheck     ← mode === 'ingredient_check' (Session 2)
            ├── RecipeHud           ← mode === 'cooking'      (Session 3)
            ├── GestureStatusRail   ← bottom-left overlay (hidden during S2 + S3)
            └── UtilityStatusPanel  ← bottom-right overlay (hidden during S2 + S3)
```

### How the mode is determined

`frontend/src/hooks/useProjectionHud.ts`

```ts
const mode: ProjectionHudMode = useMemo(() => {
    if (!isAppStarted)    return 'idle';             // Session 1
    if (isMenuOpen)       return 'menu';             // RecipeMenu
    if (isIngredientCheck) return 'ingredient_check'; // Session 2
    return 'cooking';                                // Session 3
}, [isAppStarted, isIngredientCheck, isMenuOpen]);
```

**State transitions:**

| Action | From → To |
|---|---|
| `openMenu()` | any → menu |
| `selectRecipe(i)` | menu → ingredient_check |
| `startCooking()` | ingredient_check → cooking |
| `reset()` | any → idle |
| `BACK_TO_MENU` gesture | any → menu |
| `RESET_APP` gesture | any → idle |

### Gesture action strings (`contracts.ts`)

```ts
type GestureAction =
    | 'START_APP'       // idle → menu
    | 'RESET_APP'       // any → idle
    | 'MENU_NEXT'       // cycles recipe +1 in menu
    | 'MENU_PREVIOUS'   // cycles recipe -1 in menu
    | 'MENU_CLOSE'      // closes menu
    | 'BACK_TO_MENU'    // cooking/ingredient_check → menu
    | 'SELECT_RECIPE'   // menu → ingredient_check
    | 'NEXT_STEP'       // cooking: step +1
    | 'PREVIOUS_STEP'   // cooking: step -1
    | 'NO_ACTION'       // ignored
```

---

## Full-Screen Layout — How Sizing Works

Every level of the parent chain must declare a height, otherwise `h-full` collapses to zero.

```
html              height: 100%    ← frontend/src/index.css
body              height: 100%    ← frontend/src/index.css
#root             height: 100%    ← frontend/src/App.css
ProjectionLayout  w-screen h-screen
  └─ children wrapper  w-full h-full
       └─ ProjectionHud  h-full w-full
            └─ StartScreen / IngredientCheck / RecipeHud  fills parent
```

### Background layers (ProjectionLayout.tsx)

1. **Camera feed** — only shown when backend streams video (`opacity-100`)
2. **Scanline grid** — `#2bdff0` 1px lines on a 52×52px grid, `opacity-[0.08]`
3. **Vignette** — dark radial gradient at edges, `opacity-70`

> **Note:** Sessions 2 and 3 render their own full-coverage background (`#F1F5F9` and `#0A0F1A`), which hides the `ProjectionLayout` layers beneath them.

---

## Google Fonts Loaded (`index.html`)

```html
<!-- frontend/index.html -->
family=Cousine            → monospace digits/amounts (Session 2)
family=Dangrek            → "0/5 REQUIRED" display badge (Session 2)
family=Instrument+Sans    → recipe title header (Session 2)
family=Space+Mono         → available (unused currently)
family=Sometype+Mono      → RecipeMenu sci-fi headings
```

To add more fonts, append `&family=Font+Name:wght@...` to the existing `<link>` in `frontend/index.html`.

---

## Session 1 — Start Screen (`StartScreen.tsx`)

### When it renders
Mode = `idle`. First screen after launch — no recipe selected yet.

### Visual description
Dark `#030908` background (from `ProjectionLayout`), centered column:
- Animated 3-ring scanner (cyan `#22D3EE`, Tailwind `border-cyan-400`)
- Title: **"JUST YOU AND YOUR RECIPES"**
- Subtitle: "INTERACTIVE COOKING SYSTEM 1.0"
- Status dot (green connected / red disconnected) + label
- Instruction: "USE BOTH INDEX FINGERS TO START"
- Manual **Initialize** button (visible after recipes load)

### Props

```ts
interface StartScreenProps {
    isConnected: boolean;
    isLoadingRecipes: boolean;
    recipeError: string | null;
    onStart: () => void;
}
```

### Styling approach

Session 1 uses **Tailwind CSS classes only** — no inline `style` props.

---

### Typography reference (Session 1)

| Element | Tailwind classes | Effective style |
|---|---|---|
| Main title | `text-4xl font-bold tracking-widest text-white uppercase` | 36px / 700 / white / letterSpacing widest |
| Subtitle | `text-sm tracking-widest text-cyan-300/60 font-mono` | 14px / 400 / `rgba(103,232,249,0.6)` / monospace |
| Status label | `text-xs font-mono tracking-widest text-slate-300` | 12px / 400 / `#CBD5E1` / monospace |
| Instruction text | `text-xs tracking-widest text-slate-400 leading-relaxed font-mono` | 12px / 400 / `#94A3B8` / monospace |
| Initialize button | `text-sm font-bold tracking-widest uppercase text-cyan-300` | 14px / 700 / `#67E8F9` |

---

### How to edit fonts — Session 1

All text is controlled with Tailwind class strings directly on JSX elements.

#### Change any text size

Swap the size token on the element:
```tsx
// StartScreen.tsx — main title (~line 50)
<h1 className="text-4xl font-bold tracking-widest text-white uppercase">
//             ^^^^^^^^ change to: text-3xl / text-5xl / text-[32px]
```

#### Change text color

```tsx
// Subtitle (~line 53)
<p className="text-sm tracking-widest text-cyan-300/60 font-mono">
//                                    ^^^^^^^^^^^^^^^^ change color token
// Examples: text-violet-300/80  |  text-white/50  |  text-[#A78BFA]
```

#### Change font family

```tsx
// Add inline style for a non-Tailwind font
<h1
  className="text-4xl font-bold tracking-widest text-white uppercase"
  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
>
  JUST YOU AND YOUR RECIPES
</h1>
```

Available Google Fonts (from `index.html`): `Cousine`, `Dangrek`, `Instrument Sans`, `Space Mono`, `Sometype Mono`.

#### Change letter-spacing

Tailwind letter-spacing tokens: `tracking-normal` | `tracking-wide` | `tracking-wider` | `tracking-widest`
For exact values: `tracking-[0.15em]`

#### Change the Initialize button

```tsx
// StartScreen.tsx — lines 97–106
<motion.button
    onClick={onStart}
    className="px-6 py-3 bg-cyan-500/20 border border-cyan-400 rounded-lg
               text-cyan-300 font-bold tracking-widest uppercase text-sm
               hover:bg-cyan-500/30 transition-colors"
    // ↑ change bg-cyan-500/20 for fill
    // ↑ change border-cyan-400 for border color
    // ↑ change text-cyan-300 for text color
    // ↑ change rounded-lg for corner radius
>
    Initialize   {/* ← edit button label */}
</motion.button>
```

#### Change scanner ring colors / sizes

```tsx
// StartScreen.tsx — lines 28–44
// Outer ring (160px): border-cyan-400, opacity pulses 0.3↔0.1
// Middle dashed (inset-2 from outer): border-cyan-400, rotates 360° in 12s
// Inner dot: bg-cyan-400, scale pulses 1.0↔1.2

// To change all rings to purple:
// Replace "border-cyan-400" and "bg-cyan-400" with "border-violet-400" and "bg-violet-400"

// Ring size is "size-40" (160px) on the outer wrapper (~line 27)
// Change to size-48 (192px) or size-32 (128px)
```

#### Change connected / disconnected colors

```tsx
// StartScreen.tsx — lines 80–81
style={{
    backgroundColor: isConnected ? '#4DFFB3' : '#FF5A6A',
//                                  ^^^^^^^^    ^^^^^^^^
//                                  connected   disconnected
}}
```

---

## Session 2 — Ingredient Check (`IngredientCheck.tsx`)

### When it renders
Mode = `ingredient_check`. Triggered automatically after the user selects a recipe in the menu. Exits to Session 3 via **START COOKING →** button (or future gesture/YOLO trigger).

### Visual description
Light `#F1F5F9` background. White inner card with 3-column layout:
- **Left 256px** — scrollable ingredient checklist + utensils
- **Center flex-1** — camera/YOLO detection zone with corner brackets
- **Right 280px** — detected items (YOLO output) + gesture guide + START COOKING button

### Props

```ts
interface IngredientCheckProps {
    recipe: Recipe;
    isConnected: boolean;
    lastAction: GestureAction | null;
    onReady: () => void;    // → startCooking() → Session 3
    onBack: () => void;     // → openMenu() → back to recipe list
}
```

### Styling approach

Session 2 uses **inline `style` objects only** — no Tailwind classes.

---

### Typography reference (Session 2)

#### Header / Status pills

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` | `lineHeight` |
|---|---|---|---|---|---|---|
| WEBSOCKET CONNECTED | `#475569` | 11.20 | Inter | 700 | 1.12 | 16.80px |
| LAST GESTURE text | `#475569` | 11.20 | Inter | 700 | 1.12 | 16.80px |

#### Scan state tab pills

| State | Active `color` / bg | Inactive `color` / bg | `fontSize` | `fontFamily` | `letterSpacing` |
|---|---|---|---|---|---|
| EMPTY / DETECTING / MATCHED / WRONG ITEM / READY | `#0284C7` / `#EFF6FF` | `#64748B` / `white` | 9.60 | Inter 700 | 1.15 |

#### Progress row

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| PROGRESS label | `#64748B` | 10.56 | Inter | 400 | 3.17 |
| 0/5 counter | `#0284C7` | 13.60 | **Cousine** | 700 | — |

#### Recipe title row

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| "[RECIPE] — INGREDIENT CHECK" | `#1143B7` | 19.20 | **Instrument Sans** | 500 | 0.58 |
| "0/5 REQUIRED" badge | `#0284C7` | 13.60 | **Dangrek** | 400 | 0.68 |

#### Left panel — Section labels

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| INGREDIENTS | `#64748B` | 10.56 | Inter | 600 | 3.17 |
| UTENSILS | `#64748B` | 10.56 | Inter | 600 | 3.17 |

#### Left panel — Ingredient rows

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | Notes |
|---|---|---|---|---|---|
| Ingredient name | `#0F172A` | 13.60 | Inter | 700 | uppercase, letterSpacing 0.54 |
| (REQUIRED) tag | `#D97706` | 10.40 | Inter | 400 | |
| (OPTIONAL) tag | `#94A3B8` | 10.40 | Inter | 400 | |
| Amount (e.g. 400g) | `#0284C7` | 10.40 | **Cousine** | 400 | |
| Avatar letter | `#0284C7` | 9.60 | Inter | 700 | bg `#E0F2FE`, borderRadius 8 |

#### Left panel — Utensil rows

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` |
|---|---|---|---|---|
| Utensil name | `#475569` | 12 | Inter | 400 |
| (required) / (optional) | `#94A3B8` | 9.60 | Inter | 400 |

#### Center panel — Detection zone placeholder

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| PLACE INGREDIENTS TO SCAN | `#0284C7` | 16 | Inter | 500 | 2.40 |
| "Hold each item above…" | `#94A3B8` | 12 | Inter | 400 | — |

#### Right panel — Gesture Guide

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| GESTURE GUIDE header | `#7C3AED` | 11.20 | Inter | 700 | 1.68 |
| INGREDIENT CHECK badge | `#7C3AED` | 8.80 | Inter | 700 | 0.88 |
| SCAN / BACK labels | `#7C3AED` | 11.20 | Inter | 700 | 0.67 |
| Gesture descriptions | `#64748B` | 10.40 | Inter | 400 | — |
| SAY "READY" TO CONFIRM | `#7C3AED` | 10.40 | Inter | 500 | 0.52 |
| DETECTED ITEMS label | `#64748B` | 10.56 | Inter | 600 | 3.17 |

#### Footer

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` |
|---|---|---|---|---|
| "Recipe:" label | `#94A3B8` | 11.20 | Inter | 400 |
| Recipe name | `#0F172A` | 12 | Inter | 500 |
| "Session 2 of 3" | `#64748B` | 11.20 | Inter | 400 |
| "N ITEMS REMAINING" | `#94A3B8` | 10.40 | **Cousine** | 400 |

---

### How to edit fonts — Session 2

All inline styles. The shared section-label style is a constant defined **inside** the component body:

```tsx
// IngredientCheck.tsx — ~line 215
const sectionLabel: React.CSSProperties = {
    color: '#64748B',          // ← label color for INGREDIENTS / UTENSILS
    fontSize: 10.56,           // ← label size
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    textTransform: 'uppercase',
    lineHeight: '15.84px',
    letterSpacing: 3.17,       // ← wide tracking
};
```

#### Change the main recipe title

```tsx
// IngredientCheck.tsx — inside TITLE ROW section
<span style={{
    color: '#1143B7',                              // ← color
    fontSize: 19.20,                               // ← size
    fontFamily: "'Instrument Sans', Inter, sans-serif", // ← font
    fontWeight: 500,                               // ← weight
    textTransform: 'uppercase',
    lineHeight: '28.80px',
    letterSpacing: 0.58,
}}>
```

#### Change the required/progress counter font

The progress counter and item counts use `Cousine` (a monospace font):
```tsx
// Progress row counter
<span style={{
    color: '#0284C7',
    fontSize: 13.60,
    fontFamily: "'Cousine', 'Courier New', monospace", // ← swap font here
    fontWeight: 700,
    lineHeight: '20.40px',
}}>
```
Replace `'Cousine'` with any loaded monospace font, or with `'Inter'` for a sans-serif counter.

#### Change ingredient name style

```tsx
// IngredientCheck.tsx — IngredientRow sub-component (~line 143)
<div style={{
    color: '#0F172A',          // ← name color
    fontSize: 13.60,           // ← name size
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,           // ← weight (try 500 for lighter)
    textTransform: 'uppercase',
    lineHeight: '20.40px',
    letterSpacing: 0.54,
}}>
```

#### Change the (REQUIRED) / (OPTIONAL) tag colors

```tsx
// IngredientRow — tagColor is computed:
const tagColor = optional ? '#94A3B8' : '#D97706';
//                           ^^^^^^^^    ^^^^^^^^
//                           OPTIONAL    REQUIRED
```

#### Change Gesture Guide panel text

```tsx
// GESTURE GUIDE header
<span style={{
    color: '#7C3AED',              // ← purple accent, change to match your theme
    fontSize: 11.20,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    textTransform: 'uppercase',
    lineHeight: '16.80px',
    letterSpacing: 1.68,
}}>GESTURE GUIDE</span>
```

#### Change the START COOKING button

```tsx
// IngredientCheck.tsx — inside GESTURE GUIDE panel, bottom
<button
    onClick={onReady}
    style={{
        background: '#7C3AED',     // ← button fill
        border: 'none',
        borderRadius: 999,
        cursor: 'pointer',
        // ... padding
    }}
>
    <span style={{
        color: 'white',            // ← text color
        fontSize: 11.20,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 1.68,
    }}>
        START COOKING →
    </span>
</button>
```

---

### Colors reference (Session 2)

| Token | Value | Where used |
|---|---|---|
| Page background | `#F1F5F9` | outer shell |
| White card background | `white` | inner card |
| White card border | `#E2E8F0` | card outline |
| Left panel background | `#FAFAFA` | ingredients panel |
| Right panel (detected) bg | `#FAFAFA` | detected items |
| Camera zone background | `#F0F9FF` | detection area |
| Camera zone border | `#93C5FD` 1.60px | detection area |
| Gesture guide background | `#FAFAFF` | right panel bottom |
| Gesture guide border | `#DDD6FE` | right panel bottom |
| Active state tab | `#0284C7` text + `#EFF6FF` bg | EMPTY tab |
| Progress bar fill | `#0284C7` | progress bar |
| YOLO / detection accent | `#0284C7` | avatar bg source color |
| Required dot | `#D97706` opacity 0.56 | right edge of ingredient row |
| Optional dot | `#CBD5E1` | right edge (optional items) |
| Avatar background | `#E0F2FE` | ingredient initial badge |
| WEBSOCKET pill border | `#CBD5E1` | left status pill |
| LAST GESTURE pill border | `#C4B5FD` | right status pill |
| Gesture accent | `#7C3AED` | gesture guide panel |
| Gesture badge bg | `#EDE9FE` | INGREDIENT CHECK badge |
| Gesture badge border | `#C4B5FD` | INGREDIENT CHECK badge |

---

### ScanState — hooking up YOLO

```ts
// IngredientCheck.tsx — line 5
export type ScanState = 'EMPTY' | 'DETECTING' | 'MATCHED' | 'WRONG ITEM' | 'READY';
```

`scanState` is currently local state defaulting to `'EMPTY'`. To drive it from YOLO detections, either:
1. Lift `scanState` into the parent and pass it as a prop, or
2. Import YOLO detection results via the WebSocket `cv_update` message inside the component.

The active tab pill highlight responds to `scanState` — the corresponding pill gets `bg: '#EFF6FF'` and `color: '#0284C7'`.

---

## Session 3 — Cooking HUD (`RecipeHud.tsx`)

### When it renders
Mode = `cooking`. Entered after the user taps **START COOKING →** in Session 2.

### Visual description
Dark `#0A0F1A` outer background with a large light `#F5F4F0` card filling the viewport. Purple accent throughout. 3-column layout:
- **Left 220px** — circular timer rings (Timer 1 normal, Timer 2 alert/red)
- **Center flex-1** — recipe header, concentric stove circles, BACK / NEXT nav
- **Right 220px** — ingredient grid, utensils list, stove status, notes

### Props

```ts
interface RecipeHudProps {
    recipe: Recipe;
    stepNumber: number;
    totalSteps: number;
    instruction: string | null;
    progressPercent: number;
    onNextStep: () => void;
    onPreviousStep: () => void;
    onOpenMenu: () => void;
    isConnected: boolean;
    lastAction: GestureAction | null;
}
```

### Styling approach

Session 3 uses **inline `style` objects only** — no Tailwind classes.
Three shared style constants are defined at the top of the file:

```ts
// RecipeHud.tsx — ~lines 138–168
const PANEL_BASE: React.CSSProperties = { ... };    // panel bg + radius + overflow
const PANEL_OVERLAY: React.CSSProperties = { ... }; // absolute tint + border on top of panels
const SECTION_LABEL: React.CSSProperties = { ... }; // purple uppercase label text
const DIVIDER: React.CSSProperties = { ... };       // 1px separator line
```

---

### Typography reference (Session 3)

#### Header — Status pills

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| WEBSOCKET text | `#6B7080` | 11 | Inter | 700 | 1.10 |
| LAST GESTURE text | `#6B7080` | 11 | Inter | 700 | 1.10 |

#### Header — Progress row

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| PROGRESS label | `rgba(107,94,184,0.85)` | 12 | Inter | 400 | 3.60 |
| Step count "N/total" | `rgba(107,94,184,0.85)` | 12 | Inter | 400 | — |

#### Left panel — Timers

| Element | Normal | Alert | `fontSize` | `fontFamily` | `fontWeight` |
|---|---|---|---|---|---|
| Index `(1)` / `(2)` | `#5B7CBC` | `#FF3D5A` | 13 | Inter | 700 |
| Timer label (SALMON SEAR) | `#5B7CBC` | `#FF8FAB` | 10 | Inter | 700 |
| Time value (01:28) | `#1E1B3A` | `#1E1B3A` | 26 | Inter | 700 |
| TIMERS section label | `rgba(107,94,184,0.85)` | — | 12 | Inter | 400 |

Timer ring SVG stroke colors:
- Normal ring stroke: `#6B5EB8`
- Alert ring stroke: `#FF3D5A`

#### Center panel — Recipe info

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| RECIPE / STEP N labels | `rgba(107,94,184,0.85)` | 12 | Inter | 400 | 3.60 |
| Recipe title | `#1E1B3A` | 22 | Inter | 500 | 0.60 |
| Instruction text | `rgba(30,27,58,0.65)` | 15 | Inter | 400 | — |
| STOVE label (center circle) | `rgba(107,94,184,0.75)` | 10 | Inter | 500 | 3 |

#### Center panel — Navigation

| Element | `color` | `background` | `fontSize` | `fontFamily` | `fontWeight` |
|---|---|---|---|---|---|
| BACK text | `rgba(30,27,58,0.65)` | `rgba(40,38,72,0.08)` | 14 | Inter | 500 |
| NEXT text | `#F5F4F0` | `#6B5EB8` | 14 | Inter | 500 |

#### Right panel

| Element | `color` | `fontSize` | `fontFamily` | `fontWeight` | `letterSpacing` |
|---|---|---|---|---|---|
| INGREDIENTS / UTENSILS / STOVE STATUS labels | `rgba(107,94,184,0.85)` | 12 | Inter | 400 | 3.60 |
| Utensil names (Skillet, Spatula, Timer) | `#6B7080` | 11 | Inter | 400 | — |
| ACTIVE status | `#6B5EB8` | 26 | Inter | 700 | — |
| Left Hand / Right Hand labels | `#1E1B3A` | 11 | Inter | 400 | — |
| "Detected" value | `#FF5A6A` | 11 | Inter | 700 | — |
| "Miss" value | `#6B7080` | 11 | Inter | 400 | — |
| Notes placeholder | `rgba(30,27,58,0.45)` | 12 | Inter | 400 | — |

---

### How to edit fonts — Session 3

#### Change ALL section labels at once (TIMERS, RECIPE, STEP, INGREDIENTS, etc.)

```tsx
// RecipeHud.tsx — ~line 156
const SECTION_LABEL: React.CSSProperties = {
    color: 'rgba(107, 94, 184, 0.85)',  // ← label color
    fontSize: 12,                         // ← label size
    fontFamily: 'Inter, sans-serif',      // ← label font
    fontWeight: 400,                      // ← weight
    lineHeight: '18px',
    letterSpacing: 3.60,                  // ← letter spacing
};
```

This const is spread with `{...SECTION_LABEL}` in every section header, so one edit changes all of them simultaneously.

#### Change the recipe title

```tsx
// RecipeHud.tsx — center panel "Recipe header text" section
<div style={{
    color: '#1E1B3A',            // ← title color
    fontSize: 22,                // ← title size (try 26 for bigger)
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,             // ← weight (try 600 or 700)
    lineHeight: '26.40px',
    letterSpacing: 0.60,
}}>
    {recipe.title.toUpperCase()}
</div>
```

#### Change the instruction text

```tsx
// RecipeHud.tsx — center panel instruction section
<div style={{
    color: 'rgba(30, 27, 58, 0.65)',  // ← text color
    fontSize: 15,                       // ← text size
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,                    // ← weight
    lineHeight: '22.50px',
}}>
    {instruction ?? 'Follow the recipe step carefully.'}
</div>
```

#### Change timer index label and time value

```tsx
// RecipeHud.tsx — TimerRing sub-component (lines 34–136)
// Colors are computed per-tone:
const indexColor = alert ? '#FF3D5A' : '#5B7CBC'; // ← (1)/(2) colors
const labelColor = alert ? '#FF8FAB' : '#5B7CBC'; // ← label colors

// Time value (01:28):
<div style={{
    color: '#1E1B3A',      // ← time digit color
    fontSize: 26,          // ← time digit size (try 28 for bigger)
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    lineHeight: '26px',
    letterSpacing: 1.30,
}}>
```

#### Change the BACK button text / style

```tsx
// RecipeHud.tsx — Footer navigation section
// BACK button:
<button style={{
    background: 'rgba(40, 38, 72, 0.08)',  // ← button fill
    borderRadius: 999,
    border: '0.80px rgba(40, 38, 72, 0.10) solid',
    // ...padding
}}>
    <ChevronLeft size={16} color="rgba(107, 94, 184, 0.70)" strokeWidth={1.8} />
    <span style={{
        color: 'rgba(30, 27, 58, 0.65)',  // ← text color
        fontSize: 14,                       // ← text size
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        lineHeight: '21px',
    }}>BACK</span>
</button>
```

#### Change the NEXT button text / fill color

```tsx
// RecipeHud.tsx — Footer navigation section
// NEXT button:
<button style={{
    background: '#6B5EB8',     // ← button fill (the primary purple)
    borderRadius: 999,
    border: 'none',
}}>
    <span style={{
        color: '#F5F4F0',      // ← text color
        fontSize: 14,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        lineHeight: '21px',
        letterSpacing: 0.70,
    }}>NEXT</span>
</button>
```

#### Change the STOVE STATUS text

```tsx
// RecipeHud.tsx — right panel STOVE STATUS section
// "ACTIVE" big label:
<div style={{
    color: '#6B5EB8',   // ← status color (change to red for danger, green for safe)
    fontSize: 26,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    lineHeight: '26px',
}}>ACTIVE</div>

// "Detected" value:
<span style={{ color: '#FF5A6A', fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>
    Detected
</span>
```

#### Change the progress bar gradient

```tsx
// RecipeHud.tsx — inside Header "Progress bar row" section
<motion.div
    style={{
        height: '100%',
        background: 'linear-gradient(90deg, #6B5EB8 0%, #7265BC 14%, #7F73C4 43%, #9085CE 79%, #9B8FD4 100%)',
        // ↑ edit the gradient stops (all purple shades currently)
        // Example for blue: 'linear-gradient(90deg, #2563EB 0%, #60A5FA 100%)'
        borderRadius: 999,
    }}
    initial={{ width: 0 }}
    animate={{ width: `${progressPercent}%` }}
/>
```

#### Change the panel overlay tint and border

```tsx
// RecipeHud.tsx — ~line 147 (applies to all 3 panels)
const PANEL_OVERLAY: React.CSSProperties = {
    position: 'absolute', inset: 0,
    background: 'rgba(40, 38, 72, 0.08)',        // ← tint color + opacity
    borderRadius: 24,
    border: '0.80px rgba(40, 38, 72, 0.10) solid', // ← border color + opacity
    pointerEvents: 'none',
};
```

---

### Colors reference (Session 3)

| Token | Value | Where used |
|---|---|---|
| Dark outer background | `#0A0F1A` | viewport fill |
| Light card background | `#F5F4F0` | main card |
| Card border | `rgba(107,94,184,0.20)` | card edge |
| Card glow | `rgba(107,94,184,0.18)` | box-shadow |
| Panel base bg | `rgba(60,55,100,0.04)` | all 3 panels |
| Panel overlay tint | `rgba(40,38,72,0.08)` | `PANEL_OVERLAY` |
| Panel border | `rgba(40,38,72,0.10)` | `PANEL_OVERLAY` |
| Divider | `rgba(40,38,72,0.08)` | `DIVIDER` |
| Primary purple | `#6B5EB8` | progress fill, NEXT button, ACTIVE label, ring |
| Timer 1 ring stroke | `#6B5EB8` | SVG path |
| Timer 2 ring stroke | `#FF3D5A` | SVG path (alert) |
| Timer 2 alert box | `rgba(255,61,90,0.06)` bg + `rgba(255,61,90,0.28)` border | |
| Section label color | `rgba(107,94,184,0.85)` | `SECTION_LABEL` |
| Primary text | `#1E1B3A` | title, time digits |
| Secondary text | `rgba(30,27,58,0.65)` | instruction, BACK text |
| Muted text | `#6B7080` | utensil names, Miss value |
| Status: Detected | `#FF5A6A` | right panel |
| Status: ACTIVE | `#6B5EB8` | right panel |
| WS pill border | `rgba(107,94,184,0.30)` | left header pill |
| Gesture pill border | `rgba(255,61,90,0.34)` | right header pill |
| Stove ring outer | `rgba(107,94,184,0.38)` border | 224px circle |
| Stove ring inner | `rgba(107,94,184,0.28)` border | 176px circle |
| Stove core | `rgba(107,94,184,0.05)` bg | 126.4px circle |

---

## File Reference Summary

| File | Session | Purpose |
|---|---|---|
| `frontend/index.html` | All | Google Fonts: Cousine, Dangrek, Instrument Sans, Sometype Mono, Space Mono |
| `frontend/src/index.css` | All | `html, body { height: 100% }` — root height anchor |
| `frontend/src/App.css` | All | `#root { height: 100%; display: flex }` |
| `frontend/src/components/ProjectionLayout.tsx` | All | `w-screen h-screen`, scanline grid, camera feed overlay |
| `frontend/src/hooks/useProjectionHud.ts` | All | State machine: idle → menu → ingredient_check → cooking |
| `frontend/src/components/hud/ProjectionHud.tsx` | All | Mode router: renders correct session component |
| `frontend/src/components/hud/StartScreen.tsx` | S1 | Idle screen — **Tailwind only** |
| `frontend/src/components/hud/RecipeMenu.tsx` | — | Dark sci-fi recipe picker — **Tailwind + framer-motion** |
| `frontend/src/components/hud/IngredientCheck.tsx` | S2 | Ingredient check — **inline styles only** |
| `frontend/src/components/hud/RecipeHud.tsx` | S3 | Cooking HUD — **inline styles only** |
| `frontend/src/components/hud/GestureStatusRail.tsx` | All | Gesture hint overlay (hidden in S2 + S3) |
| `frontend/src/components/hud/UtilityStatusPanel.tsx` | All | Status panel overlay (hidden in S2 + S3) |
| `frontend/src/components/hud/GlassPanel.tsx` | — | Reusable dark glass panel (used by overlays) |
| `frontend/src/components/svgTimerRings.ts` | S3 | SVG path data for circular timer arcs |
| `frontend/src/types/contracts.ts` | All | TypeScript types: Recipe, GestureAction, WS messages |
| `frontend/src/config.ts` | All | `API_BASE_URL` — backend address |
| `data/recipes/*.json` | All | Recipe source data |

---

## Dev Workflow

```powershell
# Frontend only (visual testing without backend)
cd frontend
npm run dev
# Open http://localhost:5173

# TypeScript type-check (no compile output)
npx tsc --noEmit

# Full stack
cd backend
uvicorn app.main:app --reload   # in a separate terminal
```

---

## Common Cross-Session Pitfalls

- **Session 1 uses Tailwind, Sessions 2 and 3 use inline styles.** They do not share theming. A color changed in Tailwind config does not affect S2 or S3.
- **`SECTION_LABEL` in RecipeHud is `const` outside the component** — it is computed once. Edit it to change all section labels in S3 simultaneously.
- **`sectionLabel` in IngredientCheck is `const` inside the component body** — same effect but scoped to S2.
- **Font stacks must quote font names with spaces:** `"'Instrument Sans', sans-serif"` — outer double-quotes are the JS string delimiter; inner single-quotes are the CSS font name quotes.
- **`Cousine` renders wider than Inter** — if amounts overflow the ingredient row, reduce `fontSize` on the amount span or set `overflow: 'hidden'` on the container.
- **`outline` vs `border` in icon sub-components** — the pixel-art icons in S2 (WifiIcon, GestureIcon, ScannerIcon) use CSS `outline` with negative `outlineOffset` to create inner strokes. Do not confuse with `border` when editing icon colors: change the `outline: '...'` value directly.
- **Decorative dots in S2** are absolutely positioned relative to the outer shell (`position: 'absolute'`). They sit outside the white card and may clip at small window sizes — this is expected behavior.
