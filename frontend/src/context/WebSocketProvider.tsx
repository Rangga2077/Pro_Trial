import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { WS_URL } from '../config';
import type {
    ClientWebSocketMessage,
    ServerWebSocketMessage,
    VoiceCommandMessage,
    VoiceStatusMessage,
} from '../types/contracts';
import { WebSocketContext } from './websocketContext';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 5000;

const KNOWN_MESSAGE_TYPES = new Set<ServerWebSocketMessage['type']>([
    'cv_update', 'llm_response', 'status', 'voice_command', 'voice_status',
]);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<ServerWebSocketMessage | null>(null);
    // Kept apart from lastMessage so the ~30 ms cv_update stream can't overwrite them.
    const [lastVoiceCommand, setLastVoiceCommand] = useState<VoiceCommandMessage | null>(null);
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatusMessage['data']>({ state: 'disabled' });

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let destroyed = false;
        let retryDelay = RECONNECT_BASE_MS;
        let retryTimeout: ReturnType<typeof setTimeout> | null = null;

        const connect = () => {
            if (destroyed) return;

            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                if (ws !== wsRef.current) return;
                console.log('WebSocket Connected');
                setIsConnected(true);
                retryDelay = RECONNECT_BASE_MS;
            };

            ws.onclose = () => {
                if (ws !== wsRef.current) return;
                console.log('WebSocket disconnected, retrying in', retryDelay, 'ms');
                setIsConnected(false);
                setVoiceStatus({ state: 'disabled' });

                retryTimeout = setTimeout(() => {
                    retryDelay = Math.min(retryDelay * 1.5, RECONNECT_MAX_MS);
                    connect();
                }, retryDelay);
            };

            ws.onerror = (error) => console.warn('WebSocket Error:', error);

            ws.onmessage = (event) => {
                if (ws !== wsRef.current) return;
                let message: ServerWebSocketMessage;
                try {
                    message = JSON.parse(event.data) as ServerWebSocketMessage;
                } catch {
                    console.warn('Ignoring invalid WebSocket payload:', event.data);
                    return;
                }
                if (!KNOWN_MESSAGE_TYPES.has(message?.type)) {
                    console.warn('Ignoring unknown WebSocket message type:', message?.type);
                    return;
                }
                if (message.type === 'voice_command') setLastVoiceCommand(message);
                if (message.type === 'voice_status') setVoiceStatus(message.data);
                setLastMessage(message);
            };
        };

        connect();

        return () => {
            destroyed = true;
            if (retryTimeout) clearTimeout(retryTimeout);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    const sendMessage = useCallback((message: ClientWebSocketMessage) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    }, []);

    return (
        <WebSocketContext.Provider value={{ isConnected, lastMessage, lastVoiceCommand, voiceStatus, sendMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};
