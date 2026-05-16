# CoCI System Architecture

CoCI is a split-stack local application: a FastAPI backend owns camera/CV/gesture processing, while an Electron React frontend owns projection UI and cooking workflow rendering.

## 1. Runtime Layout

- Backend entry point: `backend/app/main.py`
- Frontend entry point: `frontend/src/main.tsx`
- Electron shell: `frontend/electron/main.ts`
- Recipe data: `data/recipes`
- WebSocket route: `ws://localhost:8000/ws/`
- REST API prefix: `/api/v1`

## 2. Backend Layers

### API Layer
FastAPI exposes recipe, camera, status, and WebSocket routes. Endpoint modules should stay thin and delegate stateful work to services.

### Service Layer
Backend services hold reusable application behavior:

- `realtime.py` owns WebSocket connection tracking and broadcasting.
- `recipe_loader.py` reads and writes recipe JSON files from the configured recipe data directory.
- `gesture_actions.py` converts noisy raw model gestures into stable UI action events.

### CV Engine Layer
The CV engine captures frames, runs object detection, runs raw gesture recognition, draws debug annotations, and publishes typed `cv_update` messages through the realtime service.

The CV engine does not import endpoint internals. This keeps machine-learning work separate from transport code.

## 3. Frontend Layers

### WebSocket Context
`WebSocketContext` connects to the configured `VITE_WS_URL`, parses typed server messages, and exposes the latest message to React components.

### Projection UI
`ProjectionLayout` displays the camera frame streamed by the backend. `RecipeManager` consumes backend action events such as `START_APP`, `MENU_NEXT`, `MENU_PREVIOUS`, `SELECT_RECIPE`, `NEXT_STEP`, and `RESET_APP`.

React no longer debounces raw MediaPipe gestures. That decision belongs to the backend gesture action interpreter.

### Electron Wrapper
Electron provides a desktop shell, fullscreen projection support, display enumeration, and window movement through the preload bridge.

## 4. Realtime Message Flow

1. Camera frame enters `CVPipeline`.
2. YOLO returns object detections.
3. MediaPipe returns raw gestures.
4. `GestureActionInterpreter` converts raw gestures and index-fingertip motion to a final action or `NO_ACTION`.
5. `RealtimeService` broadcasts a typed `cv_update`.
6. React updates the current recipe UI from the action event.

Example `cv_update`:

```json
{
  "type": "cv_update",
  "data": {
    "frame": "<base64-jpeg>",
    "objects": [],
    "action": "MENU_NEXT"
  }
}
```

## 5. Configuration

Backend configuration lives in `backend/app/core/config.py` and can be overridden with `backend/.env`.

Important backend settings:
- `CAMERA_INDEX`
- `CAMERA_WIDTH`
- `CAMERA_HEIGHT`
- `CV_PIPELINE_ENABLED`
- `GESTURE_ACTION_COOLDOWN_SECONDS`
- `GESTURE_SWIPE_THRESHOLD`
- `GESTURE_MONITOR_ENABLED`
- `GESTURE_MONITOR_SAMPLE_SECONDS`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `RECIPE_DATA_DIR`
- `CORS_ORIGINS`

Important frontend settings:
- `VITE_API_BASE_URL`
- `VITE_WS_URL`

## 6. Testing Boundary

Smoke tests focus on behavior that can run without camera hardware:
- Recipe REST API
- WebSocket connection and typed error response
- Pure gesture-action interpretation

Camera and model behavior remain manual or hardware-assisted checks.
