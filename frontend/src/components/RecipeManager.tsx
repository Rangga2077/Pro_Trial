import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { RecipeStep } from './RecipeStep';

// Dummy recipe data
// Initial dummy data - replace with API fetch later
interface Recipe {
    id: string;
    title: string;
    description?: string;
    prep_time_minutes?: number;
    cook_time_minutes?: number;
    servings?: number;
    difficulty?: string;
    cuisine?: string;
    ingredients: Array<{ name: string; amount: number; unit: string; notes?: string }>;
    instructions: Array<{ step: number; description: string }>;
}

export const RecipeManager: React.FC = () => {
    const { lastMessage } = useWebSocket();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isAppStarted, setIsAppStarted] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [lastGestures, setLastGestures] = useState<any[]>([]);

    const menuListRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Debouncing checks
    const gestureCount = useRef<Record<string, number>>({});
    const lastActionTime = useRef<number>(0);
    const TRIGGER_COOLDOWN = 2000;
    const NAV_COOLDOWN = 800;
    const REQUIRED_FRAMES = 2;

    useEffect(() => {
        fetch('http://localhost:8000/api/v1/recipes/')
            .then(res => res.json())
            .then(data => setRecipes(data))
            .catch(err => console.error("Error fetching recipes:", err));
    }, []);

    // Selection auto-scrolling
    useEffect(() => {
        if (isMenuOpen && itemRefs.current[selectedIndex]) {
            itemRefs.current[selectedIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }, [selectedIndex, isMenuOpen]);

    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'cv_update') return;

        const gestures = lastMessage.data.gestures || [];
        setLastGestures(gestures);

        if (gestures.length === 0) {
            gestureCount.current = {};
            return;
        }

        // Special Dual Trigger Check (Left Index & Right Index)
        const hasLeftIndex = gestures.some((g: any) => g.hand === 'Left' && g.gesture === 'POINTING_UP');
        const hasRightIndex = gestures.some((g: any) => g.hand === 'Right' && g.gesture === 'POINTING_UP');

        const now = Date.now();

        if (hasLeftIndex && hasRightIndex) {
            gestureCount.current['DUAL_TRIGGER'] = (gestureCount.current['DUAL_TRIGGER'] || 0) + 1;
            if (gestureCount.current['DUAL_TRIGGER'] > 10 && now - lastActionTime.current > TRIGGER_COOLDOWN) {
                handleTriggerAction();
                gestureCount.current = {};
                lastActionTime.current = now;
            }
            return;
        } else {
            gestureCount.current['DUAL_TRIGGER'] = 0;
        }

        // Standard Gestures
        const primaryGesture = gestures[0].gesture;
        gestureCount.current[primaryGesture] = (gestureCount.current[primaryGesture] || 0) + 1;

        Object.keys(gestureCount.current).forEach(key => {
            if (key !== primaryGesture && key !== 'DUAL_TRIGGER') gestureCount.current[key] = 0;
        });

        if (now - lastActionTime.current < (isMenuOpen ? NAV_COOLDOWN : 1500)) return;

        if (gestureCount.current[primaryGesture] > REQUIRED_FRAMES) {
            handleGestureAction(primaryGesture);
            gestureCount.current[primaryGesture] = 0;
            lastActionTime.current = now;
        }

    }, [lastMessage]);

    const handleTriggerAction = () => {
        console.log("Action: DUAL TRIGGER");
        if (!isAppStarted) {
            setIsAppStarted(true);
            setIsMenuOpen(true);
        } else {
            // Revert to welcome menu
            setIsAppStarted(false);
            setIsMenuOpen(false);
            setCurrentRecipe(null);
            setCurrentStepIndex(0);
        }
    };

    const handleGestureAction = (gesture: string) => {
        if (!isAppStarted) return;

        if (gesture === 'THREE_FINGERS') {
            setIsMenuOpen(prev => !prev);
            return;
        }

        if (isMenuOpen) {
            if (gesture === 'FIVE_FINGERS' || gesture === 'OPEN_PALM') {
                setIsMenuOpen(false);
            } else if (gesture === 'POINTING_UP') {
                setSelectedIndex(prev => (prev + 1) % recipes.length);
            } else if (gesture === 'CLOSED_FIST') {
                const selected = recipes[selectedIndex];
                setCurrentRecipe(selected);
                setCurrentStepIndex(0);
                setIsMenuOpen(false);
            }
        } else if (currentRecipe) {
            if (gesture === 'OPEN_PALM') {
                if (currentStepIndex < currentRecipe.instructions.length - 1) {
                    setCurrentStepIndex(prev => prev + 1);
                }
            } else if (gesture === 'POINTING_UP') {
                if (currentStepIndex > 0) {
                    setCurrentStepIndex(prev => prev - 1);
                }
            }
        }
    };

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
            {/* 1. Welcome Screen */}
            {!isAppStarted && (
                <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-700 z-[80]">
                    <div className="mb-12 w-32 h-32 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                        <span className="text-6xl">🍳</span>
                    </div>
                    <h1 className="text-8xl font-black text-white mb-6 tracking-tighter">
                        CoCI <span className="text-blue-500">KITCHEN</span>
                    </h1>
                    <p className="text-3xl text-gray-400 max-w-2xl font-medium leading-relaxed mb-12">
                        Welcome to the future of culinary interaction.
                        No touch screens, no grease on your iPad. Just you and the food.
                    </p>
                    <div className="p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
                        <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">How to Start</p>
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-4xl">☝️</div>
                                <span className="text-xs text-gray-400">Left Index</span>
                            </div>
                            <div className="text-2xl text-white font-bold">+</div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-4xl">☝️</div>
                                <span className="text-xs text-gray-400">Right Index</span>
                            </div>
                            <div className="ml-6 text-left">
                                <p className="text-white text-lg font-bold">Hold both index fingers</p>
                                <p className="text-gray-400 text-sm">To launch the smart recipe menu</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Cooking Step Screen */}
            {isAppStarted && currentRecipe && !isMenuOpen && (
                <RecipeStep
                    stepNumber={currentStepIndex + 1}
                    instruction={currentRecipe.instructions[currentStepIndex].description}
                />
            )}

            {/* 3. Empty Cooking State */}
            {isAppStarted && !currentRecipe && !isMenuOpen && (
                <div className="text-white text-3xl font-medium opacity-50">
                    Select a recipe from the menu to begin
                </div>
            )}

            {/* 4. Centered Recipe Menu Overlay */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-3xl bg-gray-900 shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10 rounded-[40px] overflow-hidden">
                        <div className="p-10 border-b border-white/5 bg-white/5">
                            <h2 className="text-4xl font-black text-white mb-2 italic">MENU</h2>
                            <div className="flex items-center gap-4 text-gray-400 text-sm">
                                <span className="flex items-center gap-1">☝️ Scroll</span>
                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                <span className="flex items-center gap-1">✊ Select</span>
                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                <span className="flex items-center gap-1">🖐️ Cancel</span>
                            </div>
                        </div>
                        <div
                            ref={menuListRef}
                            className="p-4 grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto no-scrollbar py-6"
                        >
                            {recipes.map((recipe, index) => (
                                <div
                                    key={recipe.id}
                                    ref={(el) => { itemRefs.current[index] = el; }}
                                    className={`
                                        mx-4 p-6 rounded-3xl transition-all duration-300 flex items-center justify-between
                                        ${index === selectedIndex
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white scale-[1.02] shadow-2xl'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'}
                                    `}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black ${index === selectedIndex ? 'bg-white/20' : 'bg-white/10'}`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold tracking-tight">{recipe.title}</h3>
                                            <p className={`text-sm font-medium ${index === selectedIndex ? 'text-blue-100' : 'text-gray-500'}`}>
                                                {recipe.cuisine} • {recipe.cook_time_minutes} mins • {recipe.difficulty}
                                            </p>
                                        </div>
                                    </div>
                                    {index === selectedIndex && (
                                        <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-2xl font-bold text-xs uppercase tracking-tighter animate-pulse">
                                            <span>Fist to Start</span>
                                            <span className="text-lg">✊</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Enhanced Gesture Feedback Widget */}
            <div className={`
                fixed bottom-10 right-10 p-6 rounded-[32px] backdrop-blur-3xl border border-white/10 shadow-2xl z-50 min-w-[240px] transition-all duration-500
                ${isAppStarted ? 'bg-black/60' : 'bg-blue-900/40'}
            `}>
                <div className="flex justify-between items-start mb-4">
                    <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">Sensing Engine v2</p>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${lastGestures.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>

                <div className="flex flex-col gap-3 mb-6">
                    {lastGestures.length > 0 ? lastGestures.map((g, i) => (
                        <div key={i} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl">
                            <span className="text-2xl">
                                {g.gesture === 'POINTING_UP' ? '☝️' : g.gesture === 'CLOSED_FIST' ? '✊' : g.gesture === 'FIVE_FINGERS' ? '🖐️' : '✋'}
                            </span>
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">{g.hand} Hand</p>
                                <p className="text-white font-black text-sm">{g.gesture}</p>
                            </div>
                        </div>
                    )) : (
                        <div className="py-4 text-center text-gray-500 text-sm font-bold">SCANNING HANDS...</div>
                    )}
                </div>

                <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] text-gray-400 font-bold mb-1">SYSTEM STATE</p>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isMenuOpen ? 'bg-blue-500' : isAppStarted ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <p className="text-white font-black text-lg underline decoration-blue-500 decoration-4">
                            {isMenuOpen ? 'SELECTION' : isAppStarted ? 'COOKING' : 'IDLE'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
