import React from 'react';

export interface GlassPanelProps {
    children: React.ReactNode;
    className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '' }) => {
    return (
        <div
            className={`
                bg-slate-950/60
                border border-cyan-300/40
                backdrop-blur-xl
                rounded-[14px]
                ${className}
            `}
        >
            {children}
        </div>
    );
};
