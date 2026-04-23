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
type ClientWebSocketMessage = LLMQueryMessage;

interface LLMQueryMessage {
  type: "llm_query";
  query: string;
}
```

Example:

```json
{
  "type": "llm_query",
  "query": "What can I substitute for soy sauce?"
}
```

## WebSocket Server Messages

```ts
type ServerWebSocketMessage =
  | CVUpdateMessage
  | LLMResponseMessage
  | StatusMessage;
```

### `cv_update`

```ts
type GestureAction =
  | "START_APP"
  | "RESET_APP"
  | "MENU_NEXT"
  | "MENU_PREVIOUS"
  | "MENU_CLOSE"
  | "SELECT_RECIPE"
  | "NEXT_STEP"
  | "PREVIOUS_STEP"
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

### `llm_response`

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
