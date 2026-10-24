# CoCI API Contracts

This document describes the public HTTP and WebSocket shapes used by the current prototype.

## Base URLs

- REST API: `http://localhost:8000/api/v1`
- WebSocket: `ws://localhost:8000/ws/`
- Frontend env: `VITE_API_BASE_URL`, `VITE_WS_URL`

## Recipe Models

```ts
interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  notes?: string | null;
}

interface InstructionStep {
  step: number;
  description: string;
  timer_minutes?: number | null;
}

interface Recipe {
  id: string;
  title: string;
  description?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  servings?: number | null;
  difficulty?: string | null;
  cuisine?: string | null;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
}
```

## Recipe Endpoints

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/v1/recipes/` | `Recipe[]` |
| `GET` | `/api/v1/recipes/?q={query}` | `Recipe[]` |
| `GET` | `/api/v1/recipes/random` | `Recipe` |
| `GET` | `/api/v1/recipes/{recipe_id}` | `Recipe` |
| `POST` | `/api/v1/recipes/` | `Recipe` |
| `PUT` | `/api/v1/recipes/{recipe_id}` | `Recipe` |
| `DELETE` | `/api/v1/recipes/{recipe_id}` | `{ "message": "Recipe deleted" }` |

Create request body:

```json
{
  "title": "Example Recipe",
  "ingredients": [{ "name": "Rice", "amount": 1, "unit": "cup" }],
  "instructions": [{ "step": 1, "description": "Cook rice." }]
}
```

## Camera Endpoints

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/v1/camera/devices` | `{ "available_cameras": number[], "active_camera": number }` |
| `POST` | `/api/v1/camera/select` | `{ "status": "success", "new_index": number }` |

Select request body:

```json
{ "index": 0 }
```

## WebSocket Client Messages

The frontend sends typed JSON messages.

```ts
type ClientWebSocketMessage = LLMQueryMessage | UIModeMessage;

interface LLMQueryMessage {
  type: "llm_query";
  query: string;
}

type UIMode = "menu" | "ingredient_check" | "cooking";

/** Sent whenever the HUD screen or open recipe changes and after every
 *  reconnect, so the backend maps voice phrases for the screen that is
 *  showing and Jenny answers about the open recipe. */
interface UIModeMessage {
  type: "ui_mode";
  mode: UIMode;
  recipe_id?: string | null;   // open recipe, null on the menu
}
```

Example:

```json
{
  "type": "llm_query",
  "query": "What can I substitute for soy sauce?"
}
```

```json
{ "type": "ui_mode", "mode": "ingredient_check", "recipe_id": "fried_rice" }
```

Any other payload gets a `status` reply with `"Invalid WebSocket message"`. An `llm_query` is answered in the background, so later messages are handled while the LLM is still working.

## WebSocket Server Messages

```ts
type ServerWebSocketMessage =
  | CVUpdateMessage
  | LLMResponseMessage
  | StatusMessage
  | VoiceCommandMessage
  | VoiceStatusMessage
  | JennyStatusMessage;
```

### `cv_update`

```ts
type GestureAction =
  | "START_APP"
  | "RESET_APP"
  | "MENU_NEXT"
  | "MENU_PREVIOUS"
  | "MENU_CLOSE"
  | "BACK_TO_MENU"
  | "SELECT_RECIPE"
  | "NEXT_STEP"
  | "PREVIOUS_STEP"
  | "TOGGLE_THEME"
  // Session 2 → 3: closed fist or voice "let's cook"
  | "CONFIRM_READY"
  // Voice-only actions (never emitted by the gesture interpreter)
  | "START_TIMER"
  | "PAUSE_TIMER"
  | "RESET_TIMER"
  | "READ_STEP"
  | "CHECK_INGREDIENT"
  // Session 2: "hello jenny" starts recording one free-speech question
  | "ASK_JENNY"
  | "THEME_DARK"
  | "THEME_LIGHT"
  | "NO_ACTION";

interface Detection {
  bbox: [number, number, number, number];
  confidence: number;
  label: string;
  track_id: number;
}

interface CVUpdateMessage {
  type: "cv_update";
  data: {
    frame: string;
    objects: Detection[];
    action: GestureAction | null;
  };
}
```

The backend normally sends `null` instead of `NO_ACTION` when no UI action should fire.

Gesture actions per screen. The gesture interpreter follows the screen through `ui_mode`, so it stays in sync when the screen changes by voice or click.

| Screen (`ui_mode`) | Gesture | `action` |
|---|---|---|
| any | Both index fingers up (held), or three fingers | `RESET_APP` (back to the menu) |
| `menu` | Right / left index finger up | `MENU_NEXT` / `MENU_PREVIOUS` |
| `menu` | Closed fist | `SELECT_RECIPE` (opens Ingredient Check) |
| `menu` | Open palm | none |
| `ingredient_check` | Closed fist | `CONFIRM_READY` (start cooking) |
| `ingredient_check` | Open palm | `BACK_TO_MENU` |
| `ingredient_check` | Thumb up | `TOGGLE_THEME` |
| `ingredient_check` | Index finger up | none |
| `cooking` | Right / left index finger up | `NEXT_STEP` / `PREVIOUS_STEP` |
| `cooking` | Closed fist or open palm | `BACK_TO_MENU` |
| `cooking` | Thumb up | `TOGGLE_THEME` |

### `llm_response`

Jenny's answer, to an `llm_query` or to a question spoken after "hello jenny" (then `query` is the transcribed question).

```ts
interface LLMResponseMessage {
  type: "llm_response";
  data: {
    query: string;
    response: string;
  };
}
```

### `status`

```ts
interface StatusMessage {
  type: "status";
  data: {
    message: string;
  };
}
```

### `voice_command`

Sent once per recognized voice phrase (offline Vosk, English). The backend has already mapped the phrase for the current `ui_mode`; phrases that don't belong to that screen are never sent.

```ts
interface VoiceCommandMessage {
  type: "voice_command";
  data: {
    action: GestureAction;
    transcript: string;   // the phrase heard, e.g. "next step"
    confidence: number;   // 0–1, average Vosk word confidence
  };
}
```

| Screen (`ui_mode`) | Phrase | `action` |
|---|---|---|
| `menu` | "next" / "back" / "okay" | `MENU_NEXT` / `MENU_PREVIOUS` / `SELECT_RECIPE` |
| `ingredient_check` | "ready" | `CHECK_INGREDIENT` (frontend ticks the next unchecked ingredient) |
| `ingredient_check` | "let's cook" | `CONFIRM_READY` (start cooking) |
| `ingredient_check` | "hello jenny" | `ASK_JENNY` (the backend records the next `JENNY_LISTEN_SECONDS` as a question for Jenny; see `jenny_status`) |
| `ingredient_check` | "back to menu" | `BACK_TO_MENU` |
| `ingredient_check`, `cooking` | "black" / "white" | `THEME_DARK` / `THEME_LIGHT` |
| `cooking` | "next step", "next" | `NEXT_STEP` |
| `cooking` | "previous step", "go back" | `PREVIOUS_STEP` |
| `cooking` | "back to menu" | `BACK_TO_MENU` |
| `cooking` | "start timer" / "pause timer" / "reset timer" | `START_TIMER` / `PAUSE_TIMER` / `RESET_TIMER` (task timer) |
| `cooking` | "read step" | `READ_STEP` (frontend reads the step aloud) |

### `voice_status`

Sent to each client when it connects and to everyone whenever the recognizer state changes.

```ts
interface VoiceStatusMessage {
  type: "voice_status";
  data: {
    state: "disabled" | "listening" | "error";
    message?: string | null;   // reason, for "error"
  };
}
```

### `jenny_status`

Ask Jenny progress. Sent to each client when it connects and to everyone on every change. After "hello jenny", the backend records the question (`listening`), transcribes it with faster-whisper and asks the local LLM (`thinking`), then sends the answer as `llm_response` and returns to `idle`.

```ts
interface JennyStatusMessage {
  type: "jenny_status";
  data: {
    state: "idle" | "listening" | "thinking" | "unavailable";
    transcript?: string | null;   // the heard question, while "thinking"
    message?: string | null;      // e.g. "Didn't catch that…" (idle) or why Jenny is unavailable
  };
}
```

`unavailable` means voice is off (`VOICE_ENABLED` / `JENNY_ENABLED`) or the speech model could not load.
