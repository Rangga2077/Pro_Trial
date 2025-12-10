import React from 'react';

interface ProjectionLayoutProps {
    children: React.ReactNode;
}

import { useWebSocket } from '../../context/WebSocketContext';

export const ProjectionLayout: React.FC<ProjectionLayoutProps> = ({ children }) => {
    const { lastMessage } = useWebSocket();
    const videoFrame = lastMessage?.type === 'cv_update' ? lastMessage.data.frame : null;

    return (
        <div className="w-screen h-screen bg-black text-white overflow-hidden relative">
            {/* Video Background (Debug Mode) */}
            {videoFrame && (
                <div className="absolute inset-0 z-0">
                    <img
                        src={`data:image/jpeg;base64,${videoFrame}`}
                        alt="Camera Feed"
                        className="w-full h-full object-cover opacity-50"
                    />
                </div>
            )}

            {/* Technical Grid Background */}
            <div
                className="absolute inset-0 opacity-20 pointer-events-none z-10"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #333 1px, transparent 1px),
                        linear-gradient(to bottom, #333 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                }}
            />
            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-50 pointer-events-none z-10" />

            <div className="relative z-20">
                {children}
            </div>
        </div>
    );
};
