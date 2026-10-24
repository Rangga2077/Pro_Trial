# CoCI Agent Context

This file is the shared working context for Codex, Claude and other AI coding agents working on CoCI.
Read it before changing code, then keep edits aligned with the existing architecture and docs.

**The application currently works end to end. Change only what the task asks for.** Do not refactor, restyle, rename, re-order, or "clean up" code outside the request, and do not delete files unless asked.

## Project Summary

CoCI is a local, hands-free interactive cooking prototype: a camera and microphone at a kitchen station, and a projected HUD.

- **Backend:** a FastAPI service. It owns:
  - camera access, YOLO object detection and MediaPipe gestures;
  - gesture → action interpretation;
  - offline voice commands (Vosk, English) and voice → action interpretation;
  - recipe APIs, local LLM routing (Ollama) and WebSocket broadcasting.
- **Frontend:** a Vite + React app inside Electron. It renders the projection HUD:
  - three sessions: menu → ingredient check → cooking;
  - screen transitions, idle/attract animation, display settings and connection/voice status.
- **Data:** recipe JSON in `data/recipes/`; recipe images in `data/img/`, served as `/recipe-assets/`.
- **Main docs:** `README.md`, `docs/ARCHITECTURE.md`, `docs/API_Contracts.md`, `docs/HARDWARE_SETUP.md`.

## Runtime Boundaries

- Backend REST base: `http://localhost:8000/api/v1`
- Backend WebSocket: `ws://localhost:8000/ws/`
- Frontend dev server: `http://localhost:5173`
- Frontend API config: `frontend/src/config.ts` (`VITE_API_BASE_URL`, `VITE_WS_URL`)
- Backend config: `backend/app/core/config.py`, with optional `backend/.env`
- One-click launcher: `start_app.bat`. It starts Ollama if it isn't running (for Ask Jenny; stopped again on exit only if the launcher started it), starts the backend on `127.0.0.1` (this PC only), waits until it answers, then starts Vite + Electron.

Keep camera, CV, gesture, voice and LLM behaviour backend-owned. Keep projection UI and user workflow rendering frontend-owned.

## Important Files

### Backend
| Area | File |
|---|---|
| Entry point and lifespan (starts the CV and voice pipelines) | `backend/app/main.py` |
| Endpoints (`recipes`, `camera`, `stream` = WebSocket, `endpoints`) | `backend/app/api/v1/endpoints/` |
| WebSocket contracts | `backend/app/schemas/contracts.py` |
| Recipe schemas | `backend/app/schemas/recipe.py` |
| Realtime broadcast | `backend/app/services/realtime.py` |
| Recipe file store | `backend/app/services/recipe_loader.py` |
| Gesture → action | `backend/app/services/gesture_actions.py` (`GestureActionInterpreter`) |
| Voice phrase → action, per screen | `backend/app/services/voice_actions.py` (`PHRASES_BY_MODE`, `VoiceActionInterpreter`) |
| CV pipeline | `backend/app/engines/cv/pipeline.py` |
| YOLO wrapper | `backend/app/engines/cv/yolo.py` (loads `weights/custom_ingredients.pt` if present, else `weights/yolov10n.pt`) |
| MediaPipe gestures | `backend/app/engines/cv/gesture.py` (`weights/gesture_recognizer.task`) |
| Voice pipeline | `backend/app/engines/audio/pipeline.py` |
| Microphone + Vosk engine | `backend/app/engines/audio/stt.py` |
| LLM | `backend/app/engines/llm/` |
| Ask Jenny (session 2: "hello jenny" → recorded question → Whisper → LLM) | `backend/app/services/jenny.py` (`JennyService`), `backend/app/engines/audio/whisper_stt.py` (faster-whisper); the mic handoff is in `pipeline.py` |
| Ask Jenny benchmark (offline, not part of the app) | `backend/scripts/benchmark_assistant.py`, `assistant_questions.json` |
| Training tools (offline, not part of the app; see `docs/YOLO_TRAINING_GUIDE.md`) | `backend/scripts/ingredient_classes.py` (fixed class list, append-only), `record_ingredient_frames.py`, `auto_label_dataset.py`, `train_yolo.py` |

### Frontend
| Area | File |
|---|---|
| Entry point / app shell | `frontend/src/main.tsx` / `frontend/src/App.tsx` |
| WebSocket lifecycle | `frontend/src/context/WebSocketProvider.tsx` (+ `websocketContext.ts`, `useWebSocket.ts`) |
| Contracts | `frontend/src/types/contracts.ts` |
| Mode state machine and action handling | `frontend/src/hooks/useProjectionHud.ts` |
| Idle / activity tracking | `frontend/src/hooks/useIdleActivity.ts` |
| Layout + overlays | `frontend/src/components/ProjectionLayout.tsx`, `OverlayCanvas.tsx`, `DisplaySettings.tsx` |
| Screen router + transitions | `frontend/src/components/hud/ProjectionHud.tsx`, `screenTransitions.ts`, `EdgePulse.tsx` |
| Session 1 (menu) | `frontend/src/components/hud/RecipeMenu.tsx` (+ `GestureStatusRail.tsx`, shown on the menu only) |
| Session 2 (ingredient check) | `frontend/src/components/hud/IngredientCheck.tsx` (+ `ScanZoneAmbient.tsx`, `JennyChatPanel.tsx`, `../../hooks/useIngredientDetections.ts`) |
| Session 3 (cooking) | `frontend/src/components/hud/RecipeHud.tsx` (+ `StoveZoneAmbient.tsx`, `cookingTips.ts`, `../svgTimerRings.ts`) |
| Tip bubble (sessions 2 and 3) | `frontend/src/components/hud/TipBubble.tsx` (session 2: bottom of the scan zone; session 3: under the step text, above the stove zone) |
| Sound effects + background music | `frontend/src/audio/sfx.ts` (files in `frontend/public/sfx/`; triggered from `useProjectionHud.ts` and `IngredientCheck.tsx`) |
| Mic status pill (all sessions) | `frontend/src/components/hud/VoiceStatusIndicator.tsx` |
| Electron shell / preload bridge | `frontend/electron/main.ts` / `frontend/electron/preload.ts` (types in `frontend/src/types/electron.d.ts`) |

## Architectural Constraints

- Keep FastAPI endpoint modules thin. Put reusable behaviour in services or engine modules.
- Engine modules must not import endpoint internals. Use services and contracts to communicate.
- **Gestures:** React must never interpret raw MediaPipe gestures. Only `GestureActionInterpreter` turns raw gestures into final actions. The frontend uses only `cv_update.data.action` and the `objects` list.
- **Voice:** phrase → action mapping lives only in `voice_actions.py`.
  - `PHRASES_BY_MODE` is the single source for both the mapping and the Vosk grammar.
  - The frontend sends `ui_mode` on every screen change and reconnect, so the same word can map per screen ("next" = next recipe on the menu, next step while cooking).
  - Navigation actions go through `useProjectionHud.handleAction`. Screen-owned actions are handled in the screen: `CHECK_INGREDIENT` ("ready") in `IngredientCheck.tsx`, the task timer and `READ_STEP` in `RecipeHud.tsx`.
- **Ingredient auto-tick (session 2):** `frontend/src/hooks/useIngredientDetections.ts` maps `cv_update.data.objects` labels to recipe ingredients by exact name (`DETECTOR_INGREDIENTS`). Only classes the deployed model is trained on belong there; append when `custom_ingredients.pt` gains a class.
  - Voice commands are ignored while `speechSynthesis` is speaking.
- **WebSocket provider:** `lastVoiceCommand`, `voiceStatus`, `llmHistory` (Jenny replies, last 20) and `jennyStatus` are kept separate from `lastMessage`, so the ~30 ms `cv_update` stream cannot overwrite them. Keep it that way.
- **Ask Jenny:** while Jenny records a question, the mic chunks go to Jenny instead of Vosk, and the frontend mutes effects and lowers the music (`setJennyListening` in `sfx.ts`). LLM calls never block the WebSocket receive loop (`llm_query` runs in a background task).
- **Contracts:** WebSocket message shapes are public. Update `backend/app/schemas/contracts.py`, `frontend/src/types/contracts.ts` and `docs/API_Contracts.md` together.
  - Server → client: `cv_update`, `llm_response`, `status`, `voice_command`, `voice_status`, `jenny_status`.
  - Client → server: `llm_query`, `ui_mode`.
- Keep recipe persistence JSON-file based unless a task explicitly introduces another storage layer.
- Preserve hardware-free testability. Tests must not need a webcam, microphone, YOLO weights, the Vosk model, MediaPipe runtime or Ollama.
  - `CV_PIPELINE_ENABLED` and `VOICE_ENABLED` gate the pipelines.
  - Speech engines are injected, so tests use fakes.
- Keep Electron-specific APIs behind the preload bridge and its TypeScript declarations.
- **Local-first:** no cloud services (speech, LLM, storage) unless the user explicitly asks for one.

## Backend Stack And Preferred Libraries

Use the libraries already present unless there is a strong reason to add another dependency.

- Web framework / server: `fastapi`, `uvicorn[standard]`
- Contracts and settings: `pydantic`, `pydantic-settings`
- HTTP client: `httpx`; testing: `pytest`
- Camera / image processing: `opencv-python`
- Object detection: `ultralytics` (YOLO; YOLO-World only for offline auto-labelling)
- Hand tracking / gestures: `mediapipe`
- Voice: `vosk` (offline, restricted grammar) and `sounddevice` (microphone)
- LLM: local Ollama via `OLLAMA_BASE_URL` / `OLLAMA_MODEL`

Backend coding preferences:

- Use Pydantic models for request, response and WebSocket payload shapes.
- Read configurable behaviour from `settings` (`backend/app/core/config.py`). Add new knobs as settings, never as hardcoded values.
- Keep gesture and voice interpretation deterministic, clock-injectable and unit-testable.
- Long-running hardware loops must not block the asyncio loop. Use a worker thread (see `VoicePipeline`). A missing device or model must report a status, not crash the app.

## Frontend Stack And Preferred Libraries

Use the current Vite, React 19, Electron and TypeScript setup.

- UI: `react`, `react-dom`; icons: `lucide-react`
- Build: `vite`, `typescript`; desktop shell: `electron`
- Styling: inline style objects with per-theme palettes in the HUD screens, and Tailwind through the existing CSS setup elsewhere; `clsx` / `tailwind-merge`
- Animation: `framer-motion` (`AnimatePresence`, `LayoutGroup`, `MotionConfig reducedMotion="user"`)
- Linting: `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks` v7 (strict rules)

Frontend coding preferences:

- Keep shared WebSocket types in `frontend/src/types/contracts.ts` and WebSocket lifecycle in `WebSocketProvider`.
- Prefer typed props and explicit TypeScript unions for UI state.
- **react-hooks v7 rules:**
  - no synchronous `setState` inside effects; use the "adjust state during render" pattern already used in `useIdleActivity`, `useTransitionKey` and `RecipeHud`;
  - no `Date.now()` / `Math.random()` during render.
- **HUD palettes:** every key must exist in both `light` and `dark` (`typeof PALETTES.light`). The menu is dark-only.
- **Layout:** the HUD must fit, with no panel covered or clipped, at 1184×741 (the default Electron window at 125% scaling), 1520×754, 1280×720, 1280×690 (minimum height), 1200×740 and 1920×1080.
  - Use flex-shrink with `minHeight` before scrolling.
  - Never add floating fixed overlays over session 2/3 panels. The tip bubbles live inside the scan zone (session 2) and under the step text (session 3). Keep the session 3 bubble out of the stove zone: pans and hands shadow the projection there.
- Idle / attract animation may only react to final gesture actions, object presence, voice commands and pointer input. Respect `prefers-reduced-motion`.
- Keep projection UI clear, high contrast and usable at distance. Avoid large UI libraries.

## Models, Data And Generated Files

- **App model weights:** `backend/app/engines/cv/weights/`.
  - `custom_ingredients.pt` is the trained ingredient model (gitignored; currently absent while it is being retrained).
  - `yolov10n.pt` is the fallback; `gesture_recognizer.task` is the MediaPipe model.
- **Vosk model:** `backend/app/engines/audio/models/vosk-model-small-en-us-0.15/` (gitignored; download link in `docs/HARDWARE_SETUP.md`).
- **Training:**
  - Datasets and runs (`data/dataset/`, `data/runs/`, `runs/`) are gitignored and local only.
  - `train_yolo.py` copies the new `best.pt` to `custom_ingredients.pt`.
  - `auto_label_dataset.py` uses `backend/yolov8s-worldv2.pt`.
- **Never commit:** `__pycache__/` and `*.pyc`, `*.pt`, `*.task`, the Vosk model, datasets and runs, `frontend/dist*`, or `frontend/tsconfig.tsbuildinfo` (generated by `tsc -b`).

## Do

- Read existing docs and nearby code before editing.
- Make small, focused changes that match existing module boundaries.
- Keep backend and frontend contracts synchronized, and update docs when public behaviour changes.
- Add or update tests for changed backend services, APIs, gesture and voice behaviour.
- Use environment variables / settings for host, port, camera, microphone, CV, voice, recipe path and LLM.
- Preserve Windows-friendly commands and paths.
- Run the narrowest useful checks before finishing, and report results faithfully.

## Do Not

- Do not change anything outside the task's scope, even if it looks improvable. Suggest it instead.
- Do not move gesture or voice interpretation from backend to frontend.
- Do not change gesture mappings, voice phrases, thresholds, timings or UI layout unless asked.
- Do not re-add the floating hint rail or status panels to sessions 2/3.
- Do not duplicate contract definitions without updating the paired backend/frontend type and `docs/API_Contracts.md`.
- Do not hardcode absolute paths, camera or microphone indexes, hostnames or model names in application logic.
- Do not require a webcam or microphone for unit tests.
- Do not introduce a database, auth system, queue, cloud speech/LLM provider or state-management library without explicit need.
- Do not hide WebSocket parse errors silently; warn or surface a useful status.
- Do not edit the recipe data format casually; it is part of the app contract.
- Do not start a second backend or Vite server when ports 8000 or 5173 are already in use. The user often runs the app via `start_app.bat`. A second uvicorn can take over 127.0.0.1:8000.
- Do not commit, push or delete files unless the user asks.

## Common Commands

Run everything (Windows):

```powershell
.\start_app.bat
```

Backend setup and run:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

API-only (no camera / microphone): set `CV_PIPELINE_ENABLED=false` and `VOICE_ENABLED=false` in `backend/.env`.

Frontend setup and run:

```powershell
cd frontend
npm install
npm run electron:dev
```

Backend tests:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests -p no:cacheprovider
```

Frontend checks:

```powershell
cd frontend
npm run build
npm run lint
```

## Testing Notes

- Prefer focused backend tests: `test_recipe_api.py`, `test_websocket.py`, `test_gesture_actions.py`, `test_voice_actions.py`.
- **Known failures:** 7 tests in `backend/tests/test_gesture_actions.py` fail on the committed gesture code (menu pointer/swipe/open-palm expectations are out of date).
  - Do not "fix" them by changing gesture behaviour unless asked.
  - Report them as pre-existing.
- The pytest cache provider may fail in restricted Windows environments; use `-p no:cacheprovider`.
- **Visual checks without hardware:** drive the Vite app in a headless browser and mock `ws://localhost:8000/ws/`. Send scripted `cv_update`, `voice_command` and `voice_status` messages, so no camera or microphone is needed. Check the viewport sizes listed above.
- Manual hardware checks (camera, projector, microphone) belong in docs or clear final notes when they cannot be automated.

## Change Checklist

Before finishing a task, check the relevant items:

- Contracts changed: backend Pydantic models, frontend TypeScript types and `docs/API_Contracts.md` are aligned.
- Gesture behaviour changed: `backend/tests/test_gesture_actions.py` is updated.
- Voice phrases or behaviour changed: `backend/tests/test_voice_actions.py`, the README voice table and `docs/API_Contracts.md` are updated.
- Recipe API changed: `backend/tests/test_recipe_api.py` is updated.
- WebSocket behaviour changed: `backend/tests/test_websocket.py` is updated.
- Frontend changed: `npm run build` and `npm run lint` were run (or a reason is documented), and layout was checked at the target viewports.
- Backend changed: relevant pytest tests were run (or a reason is documented).
- Nothing outside the task's scope was modified.
