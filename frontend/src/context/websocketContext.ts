import { createContext } from 'react';
import type { ClientWebSocketMessage, ServerWebSocketMessage } from '../types/contracts';

export interface WebSocketContextType {
    isConnected: boolean;
    lastMessage: ServerWebSocketMessage | null;
    sendMessage: (message: ClientWebSocketMessage) => void;
}

export const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);
