export interface Ingredient {
    name: string;
    amount: number;
    unit: string;
    notes?: string | null;
}

export interface InstructionStep {
    step: number;
    description: string;
    timer_minutes?: number | null;
}

export interface Recipe {
    id: string;
    title: string;
    description?: string | null;
    prep_time_minutes?: number | null;
    cook_time_minutes?: number | null;
    servings?: number | null;
    difficulty?: string | null;
    cuisine?: string | null;
    image_url?: string | null;
    ingredients: Ingredient[];
    instructions: InstructionStep[];
}

export interface Detection {
    bbox: [number, number, number, number];
    confidence: number;
    label: string;
    track_id: number;
}

export type GestureAction =
    | 'START_APP'
    | 'RESET_APP'
    | 'MENU_NEXT'
    | 'MENU_PREVIOUS'
    | 'MENU_CLOSE'
    | 'BACK_TO_MENU'
    | 'SELECT_RECIPE'
    | 'NEXT_STEP'
    | 'PREVIOUS_STEP'
    | 'TOGGLE_THEME'
    // Session 2 → 3: closed fist or voice "let's cook"
    | 'CONFIRM_READY'
    // Voice-only actions (never emitted by the gesture interpreter)
    | 'START_TIMER'
    | 'PAUSE_TIMER'
    | 'RESET_TIMER'
    | 'READ_STEP'
    | 'CHECK_INGREDIENT'
    // Session 2: "hello jenny" starts recording one free-speech question
    | 'ASK_JENNY'
    | 'THEME_DARK'
    | 'THEME_LIGHT'
    | 'NO_ACTION';

export type UIMode = 'menu' | 'ingredient_check' | 'cooking';

export interface CVUpdateMessage {
    type: 'cv_update';
    data: {
        frame: string;
        objects: Detection[];
        action: GestureAction | null;
    };
}

export interface LLMResponseMessage {
    type: 'llm_response';
    data: {
        query: string;
        response: string;
    };
}

export interface StatusMessage {
    type: 'status';
    data: {
        message: string;
    };
}

export interface VoiceCommandMessage {
    type: 'voice_command';
    data: {
        action: GestureAction;
        transcript: string;
        confidence: number;
    };
}

export type VoiceState = 'disabled' | 'listening' | 'error';

export interface VoiceStatusMessage {
    type: 'voice_status';
    data: {
        state: VoiceState;
        message?: string | null;
    };
}

export type JennyState = 'idle' | 'listening' | 'thinking' | 'unavailable';

export interface JennyStatusMessage {
    type: 'jenny_status';
    data: {
        state: JennyState;
        /** The heard question while thinking. */
        transcript?: string | null;
        /** A short note, e.g. "Didn't catch that" or why Jenny is unavailable. */
        message?: string | null;
    };
}

export interface LLMQueryMessage {
    type: 'llm_query';
    query: string;
}

/**
 * Tells the backend which HUD screen is showing, so voice phrases map per screen,
 * and which recipe is open, so Jenny can answer about it.
 */
export interface UIModeMessage {
    type: 'ui_mode';
    mode: UIMode;
    recipe_id?: string | null;
}

export type ServerWebSocketMessage =
    | CVUpdateMessage
    | LLMResponseMessage
    | StatusMessage
    | VoiceCommandMessage
    | VoiceStatusMessage
    | JennyStatusMessage;
export type ClientWebSocketMessage = LLMQueryMessage | UIModeMessage;
