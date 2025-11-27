import React from 'react';

interface ProjectionLayoutProps {
    children: React.ReactNode;
}

export const ProjectionLayout: React.FC<ProjectionLayoutProps> = ({ children }) => {
    return (
        <div className="w-screen h-screen bg-black text-white overflow-hidden relative">
            {/* Technical Grid Background */}
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #333 1px, transparent 1px),
                        linear-gradient(to bottom, #333 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                }}
            />
            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-50 pointer-events-none" />

            {children}
        </div>
    );
};
