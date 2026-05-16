import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { WS_URL } from '../config';
import type { ClientWebSocketMessage, ServerWebSocketMessage } from '../types/contracts';
import { WebSocketContext } from './websocketContext';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 5000;

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<ServerWebSocketMessage | null>(null);

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

                retryTimeout = setTimeout(() => {
                    retryDelay = Math.min(retryDelay * 1.5, RECONNECT_MAX_MS);
                    connect();
                }, retryDelay);
            };

            ws.onerror = (error) => console.warn('WebSocket Error:', error);

            ws.onmessage = (event) => {
                if (ws !== wsRef.current) return;
                try {
                    setLastMessage(JSON.parse(event.data) as ServerWebSocketMessage);
                } catch {
                    console.warn('Ignoring invalid WebSocket payload:', event.data);
                }
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
        <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};
