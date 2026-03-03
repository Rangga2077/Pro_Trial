import React, { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';

interface WebSocketContextType {
    isConnected: boolean;
    lastMessage: any;
    sendMessage: (message: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const WS_URL = 'ws://localhost:8000/ws/';
const RECONNECT_BASE_MS = 1000;   // start at 1 s
const RECONNECT_MAX_MS = 5000;   // cap at 5 s

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const retryDelay = useRef(RECONNECT_BASE_MS);
    const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const destroyed = useRef(false);   // set on unmount so retries stop

    const connect = () => {
        if (destroyed.current) return;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            if (ws !== wsRef.current) return;
            console.log('WebSocket Connected');
            setIsConnected(true);
            retryDelay.current = RECONNECT_BASE_MS; // reset backoff on success
        };

        ws.onclose = () => {
            if (ws !== wsRef.current) return;
            console.log('WebSocket Disconnected — retrying in', retryDelay.current, 'ms');
            setIsConnected(false);
            // Schedule reconnect with backoff
            retryTimeout.current = setTimeout(() => {
                retryDelay.current = Math.min(retryDelay.current * 1.5, RECONNECT_MAX_MS);
                connect();
            }, retryDelay.current);
        };

        ws.onerror = (e) => console.warn('WebSocket Error:', e);

        ws.onmessage = (event) => {
            if (ws !== wsRef.current) return;
            try {
                setLastMessage(JSON.parse(event.data));
            } catch {
                setLastMessage(event.data);
            }
        };
    };

    useEffect(() => {
        destroyed.current = false;
        connect();

        return () => {
            destroyed.current = true;
            if (retryTimeout.current) clearTimeout(retryTimeout.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    const sendMessage = (message: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(message);
        }
    };

    return (
        <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};

