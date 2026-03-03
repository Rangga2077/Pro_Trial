import React, { useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export const OverlayCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { lastMessage } = useWebSocket();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (lastMessage && lastMessage.type === 'cv_update') {
            // We no longer draw objects/gestures here.
            // The backend handles drawing all annotations directly onto the video frame,
            // which is then displayed via the <img src="data:image/jpeg;base64,..."> in ProjectionLayout.
        }
    }, [lastMessage]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            width={window.innerWidth}
            height={window.innerHeight}
        />
    );
};
