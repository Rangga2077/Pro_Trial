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
    | 'NO_ACTION';

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

export interface LLMQueryMessage {
    type: 'llm_query';
    query: string;
}

export type ServerWebSocketMessage = CVUpdateMessage | LLMResponseMessage | StatusMessage;
export type ClientWebSocketMessage = LLMQueryMessage;
