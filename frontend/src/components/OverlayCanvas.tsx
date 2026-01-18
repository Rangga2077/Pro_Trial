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
            const objects = lastMessage.data.objects || [];

            objects.forEach((obj: any) => {
                // Skip rendering for "person" detection as requested
                if (obj.label.toLowerCase() === 'person') return;

                const [x1, y1, x2, y2] = obj.bbox;
                const width = x2 - x1;
                const height = y2 - y1;

                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 4;
                ctx.strokeRect(x1, y1, width, height);

                ctx.fillStyle = '#00FF00';
                ctx.font = '24px Arial';
                ctx.fillText(`${obj.label} (${Math.round(obj.confidence * 100)}%)`, x1, y1 - 10);
            });
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
