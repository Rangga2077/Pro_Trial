import { createContext } from 'react';
import type {
    ClientWebSocketMessage,
    JennyStatusMessage,
    LLMResponseMessage,
    ServerWebSocketMessage,
    VoiceCommandMessage,
    VoiceStatusMessage,
} from '../types/contracts';

export interface WebSocketContextType {
    isConnected: boolean;
    lastMessage: ServerWebSocketMessage | null;
    /** Most recent recognized voice command (a new object per command). */
    lastVoiceCommand: VoiceCommandMessage | null;
    voiceStatus: VoiceStatusMessage['data'];
    /** Jenny (local LLM) replies, oldest first. Kept apart from lastMessage like lastVoiceCommand. */
    llmHistory: LLMResponseMessage['data'][];
    /** Ask Jenny state (listening / thinking / idle / unavailable), kept apart from lastMessage. */
    jennyStatus: JennyStatusMessage['data'];
    sendMessage: (message: ClientWebSocketMessage) => void;
}

export const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);
