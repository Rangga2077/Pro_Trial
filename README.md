# CoCI Project - Hardware-Free Testing Guide

CoCI is a local interactive cooking prototype. The backend captures camera frames, runs CV/gesture processing, converts noisy raw gestures into action events, and streams updates to an Electron React frontend.

## Current Architecture

### Backend
- FastAPI app entry point: `backend/app/main.py`
- REST API prefix: `http://localhost:8000/api/v1`
- WebSocket route: `ws://localhost:8000/ws/`
- Recipe data: `data/recipes`
- Realtime connection service: `backend/app/services/realtime.py`
- Gesture action interpreter: `backend/app/services/gesture_actions.py`
- Recipe file store: `backend/app/services/recipe_loader.py`

### Frontend
- React/Vite source: `frontend/src`
- Electron main/preload source: `frontend/electron`
- Frontend API config: `frontend/src/config.ts`
- Shared TypeScript contracts: `frontend/src/types/contracts.ts`

### Data Flow
1. `CVPipeline` reads frames from the configured camera.
2. YOLO produces object detections.
3. MediaPipe produces raw hand gestures.
4. The backend gesture interpreter converts raw gestures into action events such as `START_APP`, `MENU_NEXT`, or `SELECT_RECIPE`.
5. The realtime service broadcasts `cv_update` messages to the frontend.
6. React consumes final action events instead of interpreting raw model gestures.

## Prerequisites

- Python 3.8+
- Node.js 18+ and npm
- Git
- Webcam
- Optional for LLM features: Ollama with `llama3.2`

## Configuration

Backend settings are read from `backend/.env` when present.

```env
CAMERA_INDEX=0
CAMERA_WIDTH=1280
CAMERA_HEIGHT=720
CV_PIPELINE_ENABLED=true
GESTURE_ACTION_COOLDOWN_SECONDS=0.5
GESTURE_SWIPE_THRESHOLD=0.20
GESTURE_MONITOR_ENABLED=true
GESTURE_MONITOR_SAMPLE_SECONDS=0.25
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
RECIPE_DATA_DIR=../data/recipes
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Frontend settings use Vite environment variables.

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/
```

## Backend Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

The CV pipeline starts by default. For API-only development or tests, set `CV_PIPELINE_ENABLED=false`.

## Frontend Setup

```powershell
cd frontend
npm install
npm run electron:dev
```

This starts the Vite dev server and launches the Electron window.

## Verification

Run frontend checks:

```powershell
cd frontend
npm run build
npm run lint
```

Run backend smoke tests:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests -p no:cacheprovider
```

The `-p no:cacheprovider` flag avoids pytest cache writes in restricted Windows sandbox environments.

## API Overview

Recipe endpoints:
- `GET /api/v1/recipes/`
- `GET /api/v1/recipes/random`
- `GET /api/v1/recipes/{recipe_id}`
- `POST /api/v1/recipes/`
- `PUT /api/v1/recipes/{recipe_id}`
- `DELETE /api/v1/recipes/{recipe_id}`

Camera endpoints:
- `GET /api/v1/camera/devices`
- `POST /api/v1/camera/select`

WebSocket endpoint:
- `ws://localhost:8000/ws/`

See `docs/API_Contracts.md` for message shapes.

## Troubleshooting

| Issue | Likely Cause | Fix |
| --- | --- | --- |
| Frontend disconnected | Backend not running or `VITE_WS_URL` mismatch | Start FastAPI and confirm `ws://localhost:8000/ws/` |
| No recipes shown | `RECIPE_DATA_DIR` points to an empty folder | Confirm JSON files exist in `data/recipes` |
| Camera does not open | Webcam busy or wrong index | Close other camera apps or change `CAMERA_INDEX` |
| LLM response fails | Ollama is not running or model missing | Start Ollama and pull the configured model |
