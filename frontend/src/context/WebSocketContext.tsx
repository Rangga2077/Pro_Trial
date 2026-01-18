import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface WebSocketContextType {
    isConnected: boolean;
    lastMessage: any;
    sendMessage: (message: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);

    const wsRef = React.useRef<WebSocket | null>(null);

    useEffect(() => {
        // Connect to the backend WebSocket
        const ws = new WebSocket('ws://localhost:8000/ws/');
        wsRef.current = ws;

        ws.onerror = (e) => console.error("WebSocket Error:", e);

        ws.onopen = () => {
            console.log('WebSocket Connected');
            if (ws === wsRef.current) {
                setIsConnected(true);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket Disconnected');
            if (ws === wsRef.current) {
                setIsConnected(false);
            }
        };

        ws.onmessage = (event) => {
            // Only process messages from the current active socket
            if (ws !== wsRef.current) return;

            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);
            } catch (e) {
                setLastMessage(event.data);
            }
        };

        setSocket(ws);

        return () => {
            ws.close();
            if (ws === wsRef.current) {
                wsRef.current = null;
            }
        };
    }, []);

    const sendMessage = (message: string) => {
        if (socket && isConnected) {
            socket.send(message);
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
