# CoCI Projection HUD Figma Skeleton

This document defines the first Figma skeleton for the CoCI holographic cooking UI.
Target frame: `Desktop Projection / 1366 x 768`.

## Strategy

Create the first version in your school Figma account, because that account has Pro features, team assets, templates, libraries, and shared variables. Keep this file as the design source of truth, then later map selected components to React.

Recommended file name:

```text
CoCI Projection HUD
```

Recommended pages:

```text
00 Cover
01 Foundations
02 Components
03 Screens
04 Prototype Flow
```

## Import Path

Use `docs/coci_projection_hud_skeleton.svg` as a visual starter:

1. Open Figma with your school account.
2. Create a new Design file named `CoCI Projection HUD`.
3. Create a `1366 x 768` frame.
4. Drag `docs/coci_projection_hud_skeleton.svg` into the canvas.
5. Use it as a locked reference layer.
6. Rebuild the key pieces as real Figma components with Auto Layout.

Do not keep the imported SVG as the final editable design. Use it as a guide.

## Visual Direction

The UI should feel like a projected kitchen HUD:

- Dark live-camera background.
- Translucent glass panels.
- Cyan and purple neon strokes.
- Large recipe step card in the center.
- Circular timers on the left.
- Ingredients, utensils, and stove status on the right.
- Gesture hints and system status kept small and non-distracting.

## Foundation Tokens

Create these variables/styles first:

```text
Color/HUD Cyan        #3EF7FF
Color/HUD Cyan Soft   #7DFBFF
Color/HUD Purple      #B447FF
Color/HUD Pink        #FF5FDB
Color/Active Green    #4DFFB3
Color/Warning Red     #FF5A6A
Color/Glass Fill      rgba(8, 14, 22, 0.58)
Color/Glass Border    rgba(125, 251, 255, 0.55)
Color/Text Primary    #F4FBFF
Color/Text Secondary  #A9BBC8
Color/Muted Line      rgba(255, 255, 255, 0.12)
```

Recommended radii:

```text
Radius/Panel          14
Radius/Button         8
Radius/Icon Tile      8
Radius/Timer Inner    999
```

Recommended spacing:

```text
Space/XS              4
Space/SM              8
Space/MD              16
Space/LG              24
Space/XL              32
```

## Components To Build First

### GlassPanel

Use for center and right HUD panels.

```text
Fill: Glass Fill
Stroke: HUD Cyan, 45-60%
Radius: 14
Effects: soft cyan glow, subtle shadow
Blur: background blur if available
```

### CircularTimer

Variants:

```text
Tone=cyan
Tone=purple
State=active
State=warning
State=idle
```

Content:

```text
Index: (1)
Label: SALMON SEAR
Time: 01:28
Progress ring
```

### ProgressHeader

Content:

```text
Label: PROGRESS
Step Count: 4/8
Gradient progress bar
```

### RecipeStepCard

Content:

```text
Title: CRISPY SALMON WITH ASPARAGUS
Step: STEP 4/8: SEAR SALMON
Instruction body
Back button
Next Step button
Food image slot
```

### UtilityStatusPanel

Sections:

```text
Utensils
Ingredients
Stove Status
Voice / LLM State
```

## First Screen Layout

Frame:

```text
Desktop Projection / 1366 x 768
```

Layer structure:

```text
Desktop Projection / 1366 x 768
├── Background
│   ├── Camera Feed Placeholder
│   ├── Dark Overlay
│   └── Particle / Scan Glow
├── Left Timer Rail
│   ├── CircularTimer / Salmon Sear
│   ├── CircularTimer / Asparagus Steam
│   └── CircularTimer / Total Cook Time
├── Main Recipe Panel
│   ├── ProgressHeader
│   ├── Recipe Title
│   ├── Food Image Slot
│   ├── Step Heading
│   ├── Instruction Body
│   └── Navigation Buttons
├── Right Utility Panel
│   ├── Utensils
│   ├── Ingredients
│   ├── Stove Status
│   └── Temperature Warning
└── HUD Overlays
    ├── Connection State
    ├── Last Gesture
    └── Voice State
```

## Gesture Features To Represent

Show these in the design as small hints, not large instructional cards:

```text
Both index fingers: Start / Reset
Right index: Next step
Left index: Previous step
Closed fist: Select / Menu
Open palm: Close menu
Pinch hold: Start / pause timer
Swipe left/right: Navigate steps
Swipe up/down: Scroll menu
```

Backend note: gesture interpretation must stay backend-owned. Any new gesture should be added to backend contracts, frontend contracts, docs, and tests together.

## Figma-To-Code Plan

Once the screen looks good:

1. Create React components under `frontend/src/components/hud`.
2. Match Figma names to component names.
3. Use Tailwind for layout, glass, color, and responsive sizing.
4. Use SVG for circular timer rings.
5. Add `lucide-react` for icons.
6. Keep WebSocket and gesture state from the current app.

Proposed React files:

```text
frontend/src/components/hud/GlassPanel.tsx
frontend/src/components/hud/CircularTimer.tsx
frontend/src/components/hud/ProgressHeader.tsx
frontend/src/components/hud/RecipeHud.tsx
frontend/src/components/hud/UtilityStatusPanel.tsx
frontend/src/components/hud/GestureStatusRail.tsx
```

