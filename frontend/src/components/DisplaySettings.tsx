import React, { useEffect, useState } from 'react';
import { MonitorCog, X } from 'lucide-react';
import type { ElectronDisplay } from '../types/electron';

export const DisplaySettings: React.FC = () => {
    const [displays, setDisplays] = useState<ElectronDisplay[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (!isOpen || !window.electronAPI) return;

        window.electronAPI.getDisplays()
            .then(disp => setDisplays(disp))
            .catch(err => {
                console.error('Display fetch error:', err);
                setError('Failed to fetch displays. Are we in Electron?');
            });
    }, [isOpen]);

    const handleSelectDisplay = async (id: number) => {
        if (!window.electronAPI) return;
        try {
            const res = await window.electronAPI.moveToDisplay(id);
            if (!res.success) {
                setError(res.error || 'Failed to move window');
            } else {
                setIsOpen(false);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div className="fixed left-9 top-24 z-[999]">
            {isOpen ? (
                <div className="w-72 rounded-[22px] border border-cyan-300/20 bg-[#0b1220]/95 p-4 shadow-[0_0_40px_rgba(62,247,255,0.14)] backdrop-blur-xl">
                    <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-2">
                        <h3 className="text-sm font-bold tracking-widest text-white">PROJECTION OUTPUT</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="Close projection output settings"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-3 rounded bg-red-900/30 p-2 text-xs font-bold text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        {displays.map((disp, i) => (
                            <button
                                key={disp.id}
                                onClick={() => handleSelectDisplay(disp.id)}
                                className={`flex w-full items-center justify-between rounded-xl p-3 transition-all duration-300 ${disp.isPrimary ? 'bg-gray-800 text-gray-300' : 'border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20'}`}
                            >
                                <span className="text-sm font-bold">
                                    Display {i + 1} {disp.isPrimary && '(Primary)'}
                                </span>
                                <span className="font-mono text-[10px] text-gray-500">
                                    {disp.size.width}x{disp.size.height}
                                </span>
                            </button>
                        ))}
                        {displays.length === 0 && !error && (
                            <p className="py-4 text-center text-xs italic text-gray-500">No displays detected.</p>
                        )}
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="rounded-full border border-cyan-300/25 bg-[#0b1220]/80 p-3 text-cyan-100 shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-cyan-300/10"
                    title="Projector Settings"
                    aria-label="Open projector settings"
                >
                    <MonitorCog className="h-5 w-5" />
                </button>
            )}
        </div>
    );
};
