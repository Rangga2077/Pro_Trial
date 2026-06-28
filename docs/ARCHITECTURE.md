# CoCI System Architecture

**CoCI (Contactless Cooking Interface)** is a split-stack local application that projects a cooking HUD onto a kitchen surface and accepts hands-free gesture control via a ceiling-mounted or countertop camera. The backend owns all computer vision and gesture processing; the frontend owns all projection UI and cooking-workflow state.

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         HOST MACHINE                             │
│                                                                  │
│  ┌─────────────────────────────┐   WebSocket ws://localhost:8000 │
│  │   FastAPI Backend (Python)  │◄──────────────────────────────┐ │
│  │                             │                               │ │
│  │  ┌──────────┐ ┌──────────┐  │  REST http://localhost:8000   │ │
│  │  │ CV Engine│ │  Recipe  │  │◄──────────────────────────┐  │ │
│  │  │ YOLOv10  │ │  Loader  │  │                           │  │ │
│  │  │MediaPipe │ │  (JSON)  │  │                           │  │ │
│  │  └──────────┘ └──────────┘  │                           │  │ │
│  └─────────────────────────────┘                           │  │ │
│                                                            │  │ │
│  ┌─────────────────────────────────────────────────────┐  │  │ │
│  │           Electron + React Frontend                 │  │  │ │
│  │                                                     │──┘  │ │
│  │   Menu → Ingredient Check → Cooking HUD             │◄────┘ │
│  │   Framer Motion · Tailwind · Inline Styles          │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌────────┐   ┌───────────┐   ┌──────────────┐                  │
│  │ Webcam │   │ Projector │   │  Recipe JSONs│                  │
│  └────────┘   └───────────┘   └──────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

All processes run locally. There is no cloud dependency during a cooking session. An optional Ollama LLM connection provides natural-language recipe advice if the service is running.

---

## 2. Runtime Topology

| Entry Point | Path | Role |
|---|---|---|
| Backend server | `backend/app/main.py` | FastAPI application + lifespan CV pipeline |
| Frontend dev server | `frontend/src/main.tsx` | Vite + React root |
| Electron shell | `frontend/electron/main.ts` | Desktop window, fullscreen projection |
| Recipe data | `data/recipes/*.json` | Recipe source-of-truth |
| Recipe images | `data/img/` | Served as `/recipe-assets/` static files |
| Backend config | `backend/.env` | Runtime overrides |
| Frontend config | `frontend/.env` | Vite environment variables |

**Ports:**

| Service | Default |
|---|---|
| FastAPI REST | `http://localhost:8000/api/v1` |
| WebSocket stream | `ws://localhost:8000/ws/` |
| Vite dev server | `http://localhost:5173` |

---

## 3. Backend Architecture

### 3.1 Layer Overview

```
backend/app/
├── main.py               ← FastAPI app + CORS + lifespan
├── core/
│   ├── config.py         ← Pydantic settings (env-overridable)
│   └── logging.py        ← Structured logging setup
├── api/v1/endpoints/
│   ├── recipes.py        ← Recipe CRUD
│   ├── camera.py         ← Camera device enumeration + selection
│   ├── stream.py         ← WebSocket /ws/ endpoint
│   └── endpoints.py      ← Health / misc routes
├── engines/
│   ├── cv/
│   │   ├── pipeline.py   ← CVPipeline + ThreadedCamera (main loop)
│   │   ├── gesture.py    ← MediaPipe GestureRecognizer wrapper
│   │   └── yolo.py       ← YOLOv10 + ByteTrack wrapper
│   └── llm/
│       ├── client.py     ← Ollama HTTP client
│       └── handlers.py   ← LLM request/response handling
├── services/
│   ├── realtime.py       ← WebSocket connection tracking + broadcast
│   ├── gesture_actions.py← Raw gesture → semantic UI action
│   └── recipe_loader.py  ← JSON recipe file I/O
└── schemas/
    ├── contracts.py      ← Pydantic message models (shared with frontend)
    └── recipe.py         ← Recipe + Ingredient + InstructionStep schemas
```

### 3.2 CV Engine

#### ThreadedCamera

`ThreadedCamera` reads frames from the webcam in a dedicated daemon thread, decoupling frame acquisition from the async processing loop. On Windows it uses `cv2.CAP_DSHOW` for faster initialization and sets `CAP_PROP_BUFFERSIZE=1` to ensure the freshest possible frame is always available.

```python
class ThreadedCamera:
    # Background thread continuously calls cap.read()
    # CVPipeline reads the latest frame without blocking
```

#### YOLOv10 + ByteTrack (`yolo.py`)

Object detection uses **YOLOv10n** (nano variant, `yolov10n.pt`) with **ByteTrack** multi-object tracking (`tracker="bytetrack.yaml"`). Detections include bounding box, confidence, class label, and persistent track ID. The `person` class is filtered out to suppress false positives near the user's hands.

Primary use case in the current build: **ingredient scanning** in the Ingredient Check session — detected food items will eventually be matched against the recipe's required ingredients list.

#### MediaPipe GestureRecognizer (`gesture.py`)

Uses the MediaPipe Tasks `GestureRecognizer` in **`LIVE_STREAM`** mode, which processes frames asynchronously and invokes a result callback. Configured for:

- `num_hands = 2`
- `min_hand_detection_confidence = 0.5`
- `min_tracking_confidence = 0.5`

The model weight file (`gesture_recognizer.task`) is auto-downloaded from Google's MediaPipe Models bucket on first run and cached in `engines/cv/weights/`.

The recognizer returns, per hand:
- `gesture` — one of `POINTING_UP`, `CLOSED_FIST`, `OPEN_PALM`, `VICTORY`, `THUMB_UP`, etc.
- `index_x`, `index_y` — normalized (0–1) screen coordinates of the index fingertip

### 3.3 Gesture Action Interpreter (`gesture_actions.py`)

Raw per-frame gesture data is noisy. `GestureActionInterpreter` converts it into exactly one stable `GestureAction` per frame, or `NO_ACTION`.

**Swipe detection** tracks each hand's index fingertip across frames using a `SwipeAnchor`:
- When `POINTING_UP` is detected, anchor the fingertip position.
- On each subsequent frame, compute `dx = current_x − anchor_x`.
- When `|dx| > GESTURE_SWIPE_THRESHOLD` (default `0.06`), fire `MENU_NEXT` (right swipe) or `MENU_PREVIOUS` (left swipe) and rearm.
- Debounce with `GESTURE_ACTION_COOLDOWN_SECONDS` (default `0.16 s`) to suppress double-fires.

**Other mappings:**

| Hand | Gesture | Action |
|---|---|---|
| Both | POINTING_UP simultaneously | `START_APP` |
| Either | CLOSED_FIST | `SELECT_RECIPE` / `BACK_TO_MENU` (context-dependent) |
| Either | OPEN_PALM | `RESET_APP` |
| Right | POINTING_UP swipe right | `NEXT_STEP` |
| Left | POINTING_UP swipe left | `PREVIOUS_STEP` |

An optional `GestureMonitor` logs per-frame anchor and swipe progress to stdout for debugging (`GESTURE_MONITOR_ENABLED=true`).

### 3.4 Realtime Service (`realtime.py`)

`RealtimeService` maintains the set of active WebSocket connections and exposes a `broadcast(message)` coroutine that serializes and sends to all connected clients. The CV pipeline calls `realtime_service.broadcast(...)` at the end of every processed frame.

### 3.5 Recipe Service (`recipe_loader.py`)

Reads and writes recipe JSON files from the directory configured in `RECIPE_DATA_DIR` (default `../data/recipes`). Each recipe file maps directly to the `Recipe` Pydantic schema.

---

## 4. WebSocket Message Protocol

All real-time data flows over a single WebSocket connection at `ws://localhost:8000/ws/`.

### Server → Client messages

#### `cv_update` (primary stream)

Sent on every processed camera frame (~30 fps target):

```json
{
  "type": "cv_update",
  "data": {
    "frame": "<base64-encoded JPEG>",
    "objects": [
      {
        "bbox": [x1, y1, x2, y2],
        "confidence": 0.87,
        "label": "apple",
        "track_id": 3
      }
    ],
    "action": "MENU_NEXT"
  }
}
```

`action` is `null` when no gesture is recognized, or one of:

```
START_APP | RESET_APP | MENU_NEXT | MENU_PREVIOUS | MENU_CLOSE |
BACK_TO_MENU | SELECT_RECIPE | NEXT_STEP | PREVIOUS_STEP | NO_ACTION
```

#### `llm_response`

```json
{ "type": "llm_response", "data": { "query": "...", "response": "..." } }
```

#### `status`

```json
{ "type": "status", "data": { "message": "Connected" } }
```

### Client → Server messages

#### `llm_query`

```json
{ "type": "llm_query", "query": "How do I julienne a carrot?" }
```

---

## 5. Recipe Data Model

Recipes live in `data/recipes/*.json`. Each file follows this schema:

```typescript
interface Recipe {
  id: string;
  title: string;
  description?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings?: number;
  difficulty?: "Easy" | "Medium" | "Hard";
  cuisine?: string;
  image_url?: string;           // relative path served from /recipe-assets/
  ingredients: Ingredient[];
  instructions: InstructionStep[];
}

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  notes?: string;               // "optional" marks optional ingredients
}

interface InstructionStep {
  step: number;
  description: string;
  timer_minutes?: number;       // drives the circular timer in Session 3
}
```

---

## 6. Frontend Architecture

### 6.1 Technology Stack

| Concern | Library |
|---|---|
| UI framework | React 18 + TypeScript |
| Build tool | Vite |
| Desktop shell | Electron |
| Animation | Framer Motion |
| Styling | Tailwind CSS (S1 / menu) + inline styles (S2 / S3 — Figma pixel-accurate) |
| Icons | Lucide React |
| State | `useState` / `useCallback` / `useMemo` — no external store |

### 6.2 Module Structure

```
frontend/src/
├── App.tsx                       ← Root: WebSocketProvider → ProjectionLayout → ProjectionHud
├── config.ts                     ← API_BASE_URL, WS_URL
├── types/contracts.ts            ← TypeScript mirrors of backend Pydantic schemas
├── context/
│   ├── WebSocketProvider.tsx     ← Connects, reconnects, parses server messages
│   └── useWebSocket.ts           ← Hook: { isConnected, lastMessage }
├── hooks/
│   └── useProjectionHud.ts       ← Mode state machine (see §6.3)
└── components/
    ├── ProjectionLayout.tsx       ← Full-screen wrapper + camera feed overlay + scanline grid
    └── hud/
        ├── ProjectionHud.tsx      ← Mode router: renders correct session
        ├── RecipeMenu.tsx         ← Mode: menu — carousel recipe picker
        ├── IngredientCheck.tsx    ← Mode: ingredient_check — ingredient scanning HUD
        ├── RecipeHud.tsx          ← Mode: cooking — step-by-step cooking HUD
        ├── GestureStatusRail.tsx  ← Fixed bottom-left gesture hint overlay
        ├── UtilityStatusPanel.tsx ← Fixed bottom-right status panel (cooking/check modes)
        ├── GlassPanel.tsx         ← Reusable dark glass card (used by overlays)
        ├── CircularTimer.tsx      ← SVG arc timer ring (legacy, kept for ref)
        ├── ProgressHeader.tsx     ← Progress bar (legacy, kept for ref)
        └── GlassPanel.tsx         ← Backdrop-blur panel base
```

### 6.3 Mode State Machine (`useProjectionHud.ts`)

The application has exactly three modes, managed by `useProjectionHud`:

```
┌──────┐  selectRecipe()  ┌───────────────────┐  startCooking()  ┌─────────┐
│ menu │────────────────► │ ingredient_check  │─────────────────► │ cooking │
└──────┘                  └───────────────────┘                   └─────────┘
   ▲                              │                                    │
   └──────────── openMenu() ──────┴────────────────────────────────────┘
                  (BACK_TO_MENU gesture / RESET_APP gesture)
```

The app **starts directly in `menu` mode** — there is no idle/splash screen.

**State variables:**

| Variable | Initial | Effect |
|---|---|---|
| `isAppStarted` | `true` | Always true; kept for API compatibility |
| `isMenuOpen` | `true` | `true` → mode = `menu` |
| `isIngredientCheck` | `false` | `true` → mode = `ingredient_check` |
| `currentRecipe` | `null` | Set by `selectRecipe()` |
| `currentStepIndex` | `0` | Advances via `nextStep()` / `previousStep()` |

**Gesture action dispatch** (`handleAction`):

```
cv_update.action
  → START_APP      → openMenu()
  → RESET_APP      → reset() → back to menu
  → MENU_NEXT      → setSelectedRecipeIndex(+1 mod total)
  → MENU_PREVIOUS  → setSelectedRecipeIndex(-1 mod total)
  → SELECT_RECIPE  → selectRecipe() → ingredient_check
  → BACK_TO_MENU   → openMenu()
  → NEXT_STEP      → nextStep() (cooking only)
  → PREVIOUS_STEP  → previousStep() (cooking only)
```

### 6.4 Session 1 — Recipe Menu (Carousel)

**Mode:** `menu`  
**File:** `RecipeMenu.tsx`  
**Theme:** Dark `#0C0C0F` background

An Epic Games Store–style carousel where all recipes are shown as cards fanning out from center. The featured (center) card displays the full recipe title, description, cuisine/difficulty/time badges, and a **START COOKING** CTA that triggers `selectRecipe()`.

**Card transform per distance from center:**

| Distance | `scale` | `x` offset | `dimOpacity` | `zIndex` |
|---|---|---|---|---|
| 0 (center) | 1.00 | 0 | 0 | 20 |
| ±1 | 0.76 | ±340 px | 0.42 | 15 |
| ±2 | 0.56 | ±575 px | 0.62 | 10 |
| ±3 | 0.42 | ±730 px | 0.80 | 5 (hidden) |

Navigation: chevron buttons, dot-pill indicators, gesture swipe (parent `selectedIndex` syncs back to local `activeIndex`).

### 6.5 Session 2 — Ingredient Check

**Mode:** `ingredient_check`  
**File:** `IngredientCheck.tsx`  
**Theme:** Light `#F1F5F9` background, white inner card  
**Figma origin:** Figma dev mode — light theme

Three-column layout:

| Column | Width | Content |
|---|---|---|
| Left | 256 px | Scrollable ingredient checklist + utensils |
| Center | flex-1 | Camera/YOLO detection zone with corner brackets |
| Right | 280 px | Detected items (YOLO output) + Gesture Guide |

**Header:** WebSocket status pill + last-gesture pill + scan-state tab bar (`EMPTY / DETECTING / MATCHED / WRONG ITEM / READY`) + progress bar.

**Ingredient checklist:** Each row is clickable — clicking toggles a green checkmark, updates `matchedCount`, and animates the progress bar. The **START COOKING** CTA button below the camera zone turns green when all required ingredients are checked and calls `onReady()` → `startCooking()`.

**Ingredient detection (YOLO hook point):** The camera zone center panel is a placeholder for a live camera feed. YOLO `objects` from `cv_update` messages will be matched against `recipe.ingredients` and used to auto-check rows and set `scanState`. This integration is wired but the matching logic is not yet implemented.

### 6.6 Session 3 — Cooking HUD

**Mode:** `cooking`  
**File:** `RecipeHud.tsx`  
**Theme:** Light cream `#F5F4F0` card on dark `#0A0F1A` background  
**Figma origin:** Figma dev mode — light theme

Three-column layout inside a `borderRadius: 36` card:

| Column | Width | Content |
|---|---|---|
| Left | 220 px | Two circular timer rings (SVG arcs) |
| Center | flex-1 | Recipe info · stove visualization · BACK/NEXT nav |
| Right | 220 px | Ingredient grid · utensils · stove status · notes |

**Header (integrated into card):**
- WEBSOCKET CONNECTED status pill (purple border)
- LAST GESTURE status pill (red border, updates live)
- Progress bar with purple gradient (`#6B5EB8 → #9B8FD4`)

**Timer rings:** SVG circular arcs using paths from `svgTimerRings.ts`. Timer 1 shows the current step's `timer_minutes`; Timer 2 shows the recipe's `prep_time_minutes` in alert/red mode.

**Stove visualization:** Five concentric circles with varying blur, border opacity, and box-shadow to represent the stove burner target zone. The innermost circle shows "STOVE" text.

**Navigation:** BACK (ghost pill, `ChevronLeft` icon) and NEXT (filled `#6B5EB8` pill). Gesture `NEXT_STEP` / `PREVIOUS_STEP` navigate the same path.

---

## 7. Frontend ↔ Backend Contract

The shared type contract exists in both stacks:

| File | Purpose |
|---|---|
| `backend/app/schemas/contracts.py` | Pydantic models (server-side validation + serialization) |
| `frontend/src/types/contracts.ts` | TypeScript interfaces (client-side type safety) |

These must stay in sync. Any new field added to a server message schema must be mirrored in the TypeScript interface.

---

## 8. Configuration Reference

### Backend (`backend/.env`)

| Key | Default | Description |
|---|---|---|
| `CAMERA_INDEX` | `0` | OpenCV camera index |
| `CAMERA_WIDTH` | `1280` | Capture width in pixels |
| `CAMERA_HEIGHT` | `720` | Capture height in pixels |
| `CV_PIPELINE_ENABLED` | `true` | Set `false` to disable CV (API-only dev mode) |
| `GESTURE_ACTION_COOLDOWN_SECONDS` | `0.16` | Minimum seconds between fired actions |
| `GESTURE_SWIPE_THRESHOLD` | `0.06` | Normalized x-displacement to trigger a swipe |
| `GESTURE_MONITOR_ENABLED` | `true` | Log per-frame gesture progress to stdout |
| `GESTURE_MONITOR_SAMPLE_SECONDS` | `0.25` | Logging interval for gesture monitor |
| `RECIPE_DATA_DIR` | `../data/recipes` | Path to recipe JSON directory |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed CORS origins |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server address |
| `OLLAMA_MODEL` | `llama3.2` | LLM model name |

### Frontend (`frontend/.env`)

| Key | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend REST base URL |
| `VITE_WS_URL` | `ws://localhost:8000/ws/` | WebSocket endpoint URL |

---

## 9. Real-Time Data Flow (End-to-End)

```
┌─────────────┐
│   Webcam    │  frame (BGR)
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  ThreadedCamera     │  Non-blocking background capture thread
│  (daemon thread)    │  Always holds the latest frame
└──────┬──────────────┘
       │  latest frame
       ▼
┌────────────────────────────────────────────────────┐
│                 CVPipeline.start()                  │
│  (async loop running inside FastAPI lifespan)       │
│                                                     │
│  ┌─────────────────┐   ┌────────────────────────┐  │
│  │  YOLOv10        │   │  MediaPipe             │  │
│  │  + ByteTrack    │   │  GestureRecognizer     │  │
│  │                 │   │  (LIVE_STREAM mode)    │  │
│  │  → Detection[]  │   │  → RawGesture[]        │  │
│  └─────────────────┘   └────────────┬───────────┘  │
│                                     │               │
│                         ┌───────────▼────────────┐  │
│                         │ GestureActionInterpreter│  │
│                         │  Swipe anchor tracking  │  │
│                         │  Cooldown debounce      │  │
│                         │  → GestureAction enum   │  │
│                         └───────────┬────────────┘  │
│                                     │               │
│  frame → base64 JPEG                │               │
│         +                           │               │
│  Detection[] + GestureAction        │               │
│         ↓                           │               │
│  ┌──────────────────────────────────▼─────────────┐ │
│  │           RealtimeService.broadcast()           │ │
│  │   CVUpdateMessage → JSON → all WS clients      │ │
│  └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
       │  ws message: cv_update
       ▼
┌──────────────────────────────────────────────────┐
│              React Frontend                       │
│                                                  │
│  WebSocketProvider.lastMessage                   │
│           │                                      │
│           ▼                                      │
│  useProjectionHud.handleAction(action)           │
│           │                                      │
│   ┌───────┴──────────────┐                       │
│   │  mode state machine  │                       │
│   │  menu / check / cook │                       │
│   └───────┬──────────────┘                       │
│           ▼                                      │
│   ProjectionHud renders correct session          │
│   (RecipeMenu | IngredientCheck | RecipeHud)     │
└──────────────────────────────────────────────────┘
```

---

## 10. Testing Boundaries

| Test Type | What it covers | Tool |
|---|---|---|
| Backend smoke | Recipe REST CRUD, WebSocket handshake, gesture-action pure logic | `pytest` |
| Frontend type check | All TypeScript types compile, no implicit `any` | `tsc --noEmit` |
| Frontend build | Vite bundle completes without error | `npm run build` |
| Manual — gesture | Gesture swipe + action dispatch end-to-end | Live camera session |
| Manual — ingredient | YOLO detection + ingredient matching | Live camera + test food items |
| Manual — projection | Full 3-session flow on projected surface | Projector + camera rig |

Camera-dependent behavior (YOLO inference, MediaPipe LIVE_STREAM latency, gesture sensitivity) cannot be covered by automated tests and requires physical hardware validation.
