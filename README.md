# CoCI — Contactless Cooking Interface

**CoCI** is a hands-free, gesture-driven cooking assistant designed for the kitchen environment — where your hands are wet, greasy, or occupied. A ceiling-mounted or countertop camera captures hand gestures; a projector or secondary display presents a step-by-step cooking HUD on the worksurface. No touchscreen, no voice assistant, no internet required during a session.

---

## What It Does

```
┌──────────┐    gestures     ┌──────────────┐    projection
│  Camera  │ ─────────────► │  CoCI System │ ─────────────► worksurface / monitor
└──────────┘                 └──────────────┘
                  ▲                  │
            (YOLOv10 +               │  ingredient
             MediaPipe)              ▼  detection
                             ┌──────────────┐
                             │  Recipe HUD  │
                             │  S1 · S2 · S3│
                             └──────────────┘
```

1. **Browse** — Select a recipe from a carousel interface by swiping with your index finger.
2. **Check** — Hold each ingredient above the camera zone; the system identifies it using YOLOv10 object detection.
3. **Cook** — Follow step-by-step instructions with visual timers, stove-status indicators, and gesture navigation — no touching required.

---

## Three-Session Flow

| Session | Mode | What the user sees |
|---|---|---|
| **S1 — Menu** | `menu` | Epic-style carousel. Cards fan out. Center card shows recipe details + START COOKING button. Swipe left/right to browse. |
| **S2 — Ingredient Check** | `ingredient_check` | Light-theme three-column HUD. Left: ingredient checklist. Center: camera/YOLO detection zone. Right: detected items + gesture guide. |
| **S3 — Cooking HUD** | `cooking` | Light cream card on dark background. Left: circular timer rings. Center: current step instruction + stove visualization. Right: ingredient grid, stove status. |

---

## Technology Stack

### Backend
| Component | Technology |
|---|---|
| API server | Python · FastAPI |
| Object detection | YOLOv10n + ByteTrack (Ultralytics) |
| Gesture recognition | MediaPipe GestureRecognizer (LIVE_STREAM) |
| Camera capture | OpenCV + ThreadedCamera (background thread) |
| Real-time transport | WebSocket (`ws://localhost:8000/ws/`) |
| Recipe storage | JSON files (`data/recipes/`) |
| Optional LLM | Ollama (`llama3.2`) |

### Frontend
| Component | Technology |
|---|---|
| UI framework | React 18 + TypeScript |
| Build tool | Vite |
| Desktop shell | Electron (fullscreen projection support) |
| Animation | Framer Motion |
| Styling | Tailwind CSS (menu) + inline styles (S2/S3, Figma pixel-accurate) |

---

## Prerequisites

- Python 3.8+
- Node.js 18+ and npm
- Webcam (index `0` by default)
- Projector or secondary display (optional for development)
- [Ollama](https://ollama.com/) with `llama3.2` — optional, only needed for in-session LLM cooking advice

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url>
cd Pro_Trial
```

### 2. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
```

Create `backend/.env` (optional — all values have defaults):

```env
CAMERA_INDEX=0
CAMERA_WIDTH=1280
CAMERA_HEIGHT=720
CV_PIPELINE_ENABLED=true
GESTURE_ACTION_COOLDOWN_SECONDS=0.16
GESTURE_SWIPE_THRESHOLD=0.06
RECIPE_DATA_DIR=../data/recipes
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Start the server:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

> **API-only mode (no camera required):** set `CV_PIPELINE_ENABLED=false` in `.env`.

### 3. Frontend

```powershell
cd frontend
npm install
```

Create `frontend/.env` (optional):

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/
```

Start the Electron window (dev mode with hot-reload):

```powershell
npm run electron:dev
```

Or run in the browser without Electron:

```powershell
npm run dev
# Open http://localhost:5173
```

---

## Gesture Vocabulary

| Hand | Gesture | Action |
|---|---|---|
| Both hands | Index fingers up simultaneously | `START_APP` — (legacy, app starts in menu) |
| Right index | Swipe right | `MENU_NEXT` — next recipe in carousel |
| Left index | Swipe left | `MENU_PREVIOUS` — previous recipe |
| Either | Closed fist | `SELECT_RECIPE` — confirm selection → Session 2 |
| Either | Open palm | `RESET_APP` — return to menu |
| Either | Closed fist (in menu) | `BACK_TO_MENU` — return from cooking |
| Right index | Swipe right (cooking) | `NEXT_STEP` — advance cooking step |
| Left index | Swipe left (cooking) | `PREVIOUS_STEP` — go back a step |

Gesture sensitivity is tuned via `GESTURE_SWIPE_THRESHOLD` (default `0.06` normalized units) and `GESTURE_ACTION_COOLDOWN_SECONDS` (default `0.16 s`).

---

## API Reference

### Recipe endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/recipes/` | List all recipes |
| `GET` | `/api/v1/recipes/{id}` | Get recipe by ID |
| `GET` | `/api/v1/recipes/random` | Random recipe |
| `POST` | `/api/v1/recipes/` | Create recipe |
| `PUT` | `/api/v1/recipes/{id}` | Update recipe |
| `DELETE` | `/api/v1/recipes/{id}` | Delete recipe |

### Camera endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/camera/devices` | List available camera devices |
| `POST` | `/api/v1/camera/select` | Switch active camera index |

### WebSocket

| Endpoint | Direction | Message type |
|---|---|---|
| `ws://localhost:8000/ws/` | Server → Client | `cv_update` (frame + objects + action) |
| `ws://localhost:8000/ws/` | Server → Client | `llm_response` |
| `ws://localhost:8000/ws/` | Client → Server | `llm_query` |

Full message schemas: [`docs/API_Contracts.md`](docs/API_Contracts.md)

---

## Project Structure

```
Pro_Trial/
├── backend/
│   ├── app/
│   │   ├── main.py                 ← FastAPI entry point
│   │   ├── core/config.py          ← Settings (env-overridable)
│   │   ├── engines/
│   │   │   ├── cv/
│   │   │   │   ├── pipeline.py     ← ThreadedCamera + main CV loop
│   │   │   │   ├── gesture.py      ← MediaPipe GestureRecognizer
│   │   │   │   └── yolo.py         ← YOLOv10 + ByteTrack
│   │   │   └── llm/                ← Ollama client + handlers
│   │   ├── services/
│   │   │   ├── realtime.py         ← WebSocket broadcast
│   │   │   ├── gesture_actions.py  ← Gesture → UI action mapping
│   │   │   └── recipe_loader.py    ← JSON recipe I/O
│   │   ├── api/v1/endpoints/       ← REST route handlers
│   │   └── schemas/contracts.py    ← Pydantic message models
│   ├── tests/                      ← Pytest smoke tests
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 ← Root component
│   │   ├── types/contracts.ts      ← TypeScript message types
│   │   ├── context/                ← WebSocket provider + hook
│   │   ├── hooks/useProjectionHud.ts ← Mode state machine
│   │   └── components/hud/
│   │       ├── ProjectionHud.tsx   ← Mode router
│   │       ├── RecipeMenu.tsx      ← S1: carousel menu
│   │       ├── IngredientCheck.tsx ← S2: ingredient scanning
│   │       └── RecipeHud.tsx       ← S3: cooking HUD
│   ├── electron/                   ← Electron main + preload
│   └── index.html                  ← Google Fonts: Cousine, Instrument Sans, Dangrek
│
├── data/
│   ├── recipes/                    ← Recipe JSON files
│   └── img/                        ← Recipe images (served as /recipe-assets/)
│
├── docs/
│   ├── ARCHITECTURE.md             ← This system's full architecture reference
│   ├── API_Contracts.md            ← WebSocket + REST message schemas
│   ├── HARDWARE_SETUP.md           ← Camera + projector setup guide
│   └── FRONTEND_SESSIONS_GUIDE.md  ← Per-session font / style editing reference
│
└── README.md                       ← This file
```

---

## Verification

### Backend tests

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests -p no:cacheprovider -v
```

Covers: recipe CRUD, WebSocket handshake, gesture-action pure logic.  
Camera-dependent tests require physical hardware and are verified manually.

### Frontend checks

```powershell
cd frontend
npx tsc --noEmit    # type check
npm run build       # production bundle
npm run lint        # ESLint
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "DISCONNECTED" badge in UI | Backend not running or wrong WS URL | Start FastAPI; confirm `VITE_WS_URL=ws://localhost:8000/ws/` |
| No recipes in carousel | `RECIPE_DATA_DIR` is empty or wrong path | Verify JSON files exist in `data/recipes/` |
| Camera does not open | Webcam busy or wrong index | Close other camera apps; set `CAMERA_INDEX=1` (or higher) |
| Gestures not recognised | Camera angle or lighting | Ensure hand is well-lit and fully in frame; check MediaPipe confidence thresholds |
| Gesture fires too quickly | Cooldown too short | Increase `GESTURE_ACTION_COOLDOWN_SECONDS` in `.env` |
| Swipe requires too much movement | Threshold too high | Decrease `GESTURE_SWIPE_THRESHOLD` (e.g. `0.04`) |
| YOLO model missing | First run without internet | Connect to internet once to auto-download `yolov10n.pt` |
| LLM response fails | Ollama not running or model not pulled | Run `ollama pull llama3.2` and `ollama serve` |
| Black Electron window | Vite dev server not ready | Wait 3–5 s and refresh; or run `npm run dev` first |

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full system architecture, data flow diagrams, session design |
| [`docs/API_Contracts.md`](docs/API_Contracts.md) | WebSocket message schemas, REST contract shapes |
| [`docs/HARDWARE_SETUP.md`](docs/HARDWARE_SETUP.md) | Camera rig, projector alignment, AverMedia setup |
| [`FRONTEND_SESSIONS_GUIDE.md`](FRONTEND_SESSIONS_GUIDE.md) | Per-session typography, color tokens, and style editing guide |
