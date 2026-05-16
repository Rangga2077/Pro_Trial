import React, { useState, useEffect } from 'react';
import type { ElectronDisplay } from '../types/electron';

export const DisplaySettings: React.FC = () => {
    const [displays, setDisplays] = useState<ElectronDisplay[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string>('');

    // Fetch displays only when the menu opens
    useEffect(() => {
        if (isOpen && window.electronAPI) {
            window.electronAPI.getDisplays()
                .then(disp => setDisplays(disp))
                .catch(err => {
                    console.error("Display fetch error:", err);
                    setError("Failed to fetch displays. Are we in Electron?");
                });
        }
    }, [isOpen]);

    const handleSelectDisplay = async (id: number) => {
        if (!window.electronAPI) return;
        try {
            const res = await window.electronAPI.moveToDisplay(id);
            if (!res.success) {
                setError(res.error || 'Failed to move window');
            } else {
                setIsOpen(false); // Close upon success
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div className="fixed bottom-4 left-4 z-[999]">
            {isOpen ? (
                <div className="bg-gray-900 border border-gray-700 shadow-2xl p-4 rounded-2xl w-72 backdrop-blur-xl">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                        <h3 className="text-white font-bold tracking-widest text-sm">PROJECTION OUTPUT</h3>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                        >
                            ✕
                        </button>
                    </div>

                    {error && (
                        <div className="mb-3 text-red-400 text-xs font-bold p-2 bg-red-900/30 rounded">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        {displays.map((disp, i) => (
                            <button
                                key={disp.id}
                                onClick={() => handleSelectDisplay(disp.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 ${disp.isPrimary ? 'bg-gray-800 text-gray-300' : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border border-blue-500/30'}`}
                            >
                                <span className="font-bold text-sm">
                                    Display {i + 1} {disp.isPrimary && '(Primary)'}
                                </span>
                                <span className="text-[10px] text-gray-500 font-mono">
                                    {disp.size.width}x{disp.size.height}
                                </span>
                            </button>
                        ))}
                        {displays.length === 0 && !error && (
                            <p className="text-gray-500 text-xs italic text-center py-4">No displays detected.</p>
                        )}
                    </div>
                </div>
            ) : (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="p-3 bg-gray-800/80 hover:bg-gray-700 text-gray-300 rounded-full shadow-lg backdrop-blur-md border border-gray-600/50 transition-all hover:scale-110"
                    title="Projector Settings"
                >
                    📺
                </button>
            )}
        </div>
    );
};
