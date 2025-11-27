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

    useEffect(() => {
        // Connect to the backend WebSocket
        const ws = new WebSocket('ws://localhost:8000/ws/ws');

        ws.onopen = () => {
            console.log('WebSocket Connected');
            setIsConnected(true);
        };

        ws.onclose = () => {
            console.log('WebSocket Disconnected');
            setIsConnected(false);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);
            } catch (e) {
                // Handle non-JSON messages
                setLastMessage(event.data);
            }
        };

        setSocket(ws);

        return () => {
            ws.close();
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
