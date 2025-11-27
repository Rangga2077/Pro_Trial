import React, { useEffect, useRef } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';

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
            // Draw bounding boxes (simulated)
            // In real app, iterate over lastMessage.data.objects
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 4;
            // Example box
            ctx.strokeRect(100, 100, 200, 150);

            ctx.fillStyle = '#00FF00';
            ctx.font = '24px Arial';
            ctx.fillText('Bowl', 100, 90);
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
