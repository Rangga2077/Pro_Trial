import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useWebSocket } from '../context/useWebSocket';
import type { GestureAction, Recipe, ServerWebSocketMessage } from '../types/contracts';
import { RecipeStep } from './RecipeStep';

export const RecipeManager: React.FC = () => {
    const { lastMessage } = useWebSocket();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isAppStarted, setIsAppStarted] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const lastAction = lastMessage?.type === 'cv_update' ? lastMessage.data.action : null;

    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const handledMessageRef = useRef<ServerWebSocketMessage | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/v1/recipes/`)
            .then(res => res.json())
            .then((data: Recipe[]) => {
                const nextRecipes = Array.isArray(data) ? data : [];
                setRecipes(nextRecipes);
                setSelectedIndex(index => nextRecipes.length === 0 ? 0 : Math.min(index, nextRecipes.length - 1));
            })
            .catch(err => console.error('Error fetching recipes:', err));
    }, []);

    useEffect(() => {
        if (isMenuOpen && itemRefs.current[selectedIndex]) {
            itemRefs.current[selectedIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }, [selectedIndex, isMenuOpen]);

    const resetApp = useCallback(() => {
        setIsAppStarted(false);
        setIsMenuOpen(false);
        setCurrentRecipe(null);
        setCurrentStepIndex(0);
        setSelectedIndex(0);
    }, []);

    const handleAction = useCallback((action: GestureAction) => {
        if (action === 'NO_ACTION') return;

        if (action === 'START_APP') {
            setIsAppStarted(true);
            setIsMenuOpen(true);
            return;
        }

        if (action === 'RESET_APP') {
            resetApp();
            return;
        }

        if (!isAppStarted) return;

        if (action === 'BACK_TO_MENU') {
            setIsMenuOpen(true);
            return;
        }

        if (action === 'MENU_NEXT' && isMenuOpen && recipes.length > 0) {
            setSelectedIndex(index => (index + 1) % recipes.length);
            return;
        }

        if (action === 'MENU_PREVIOUS' && isMenuOpen && recipes.length > 0) {
            setSelectedIndex(index => (index - 1 + recipes.length) % recipes.length);
            return;
        }

        if (action === 'SELECT_RECIPE' && isMenuOpen) {
            const selected = recipes[selectedIndex];
            if (!selected) return;

            setCurrentRecipe(selected);
            setCurrentStepIndex(0);
            setIsMenuOpen(false);
            return;
        }

        if (action === 'MENU_CLOSE') {
            setIsMenuOpen(false);
            return;
        }

        if (!currentRecipe || isMenuOpen) return;

        if (action === 'NEXT_STEP' && currentStepIndex < currentRecipe.instructions.length - 1) {
            setCurrentStepIndex(index => index + 1);
            return;
        }

        if (action === 'PREVIOUS_STEP' && currentStepIndex > 0) {
            setCurrentStepIndex(index => index - 1);
        }
    }, [currentRecipe, currentStepIndex, isAppStarted, isMenuOpen, recipes, resetApp, selectedIndex]);

    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'cv_update' || !lastMessage.data.action) return;
        if (handledMessageRef.current === lastMessage) return;

        handledMessageRef.current = lastMessage;

        // WebSocket messages are external events; this dispatch intentionally updates UI state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        handleAction(lastMessage.data.action);
    }, [handleAction, lastMessage]);

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
            {!isAppStarted && (
                <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-700 z-[80]">
                    <div className="mb-12 w-32 h-32 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                        <span className="text-5xl font-black">CoCI</span>
                    </div>
                    <h1 className="text-8xl font-black text-white mb-6">
                        CoCI <span className="text-blue-500">KITCHEN</span>
                    </h1>
                    <p className="text-3xl text-gray-400 max-w-2xl font-medium leading-relaxed mb-12">
                        Welcome to the future of culinary interaction.
                        No touch screens, no grease on your tablet. Just you and the food.
                    </p>
                    <div className="p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
                        <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Start Gesture</p>
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-4xl font-black">L1</div>
                                <span className="text-xs text-gray-400">Left Index</span>
                            </div>
                            <div className="text-2xl text-white font-bold">+</div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-4xl font-black">R1</div>
                                <span className="text-xs text-gray-400">Right Index</span>
                            </div>
                            <div className="ml-6 text-left">
                                <p className="text-white text-lg font-bold">Hold both index fingers</p>
                                <p className="text-gray-400 text-sm">Launch the recipe menu</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isAppStarted && currentRecipe && !isMenuOpen && (
                <RecipeStep
                    stepNumber={currentStepIndex + 1}
                    instruction={currentRecipe.instructions[currentStepIndex].description}
                />
            )}

            {isAppStarted && !currentRecipe && !isMenuOpen && (
                <div className="text-white text-3xl font-medium opacity-50">
                    Select a recipe from the menu to begin
                </div>
            )}

            {isMenuOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-3xl bg-gray-900 shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10 rounded-[40px] overflow-hidden">
                        <div className="p-10 border-b border-white/5 bg-white/5">
                            <h2 className="text-4xl font-black text-white mb-2 italic">MENU</h2>
                            <div className="flex items-center gap-4 text-gray-400 text-sm">
                                <span className="flex items-center gap-1">Left index once to move</span>
                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                <span className="flex items-center gap-1">Fist to select</span>
                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                <span className="flex items-center gap-1">Open palm to close</span>
                            </div>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto no-scrollbar py-6">
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
                                            <h3 className="text-2xl font-bold">{recipe.title}</h3>
                                            <p className={`text-sm font-medium ${index === selectedIndex ? 'text-blue-100' : 'text-gray-500'}`}>
                                                {recipe.cuisine} / {recipe.cook_time_minutes} mins / {recipe.difficulty}
                                            </p>
                                        </div>
                                    </div>
                                    {index === selectedIndex && (
                                        <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-2xl font-bold text-xs uppercase animate-pulse">
                                            <span>Ready</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isAppStarted && (
                <div className="fixed bottom-10 left-10 z-50 w-[280px] rounded-[24px] border border-white/10 bg-black/55 p-5 shadow-2xl backdrop-blur-2xl">
                    <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Gestures</p>
                    <div className="grid gap-3 text-sm font-bold text-white">
                        {isMenuOpen ? (
                            <>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-300">Left index once</span>
                                    <span className="text-blue-300">Move</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-300">Closed fist once</span>
                                    <span className="text-blue-300">Select</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-300">Open palm</span>
                                    <span className="text-blue-300">Close</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-300">Right index once</span>
                                    <span className="text-blue-300">Next</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-300">Left index once</span>
                                    <span className="text-blue-300">Previous</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-gray-300">Closed fist once</span>
                                    <span className="text-blue-300">Menu</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className={`
                fixed bottom-10 right-10 p-6 rounded-[32px] backdrop-blur-3xl border border-white/10 shadow-2xl z-50 min-w-[240px] transition-all duration-500
                ${isAppStarted ? 'bg-black/60' : 'bg-blue-900/40'}
            `}>
                <div className="flex justify-between items-start mb-4">
                    <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">Action Engine v1</p>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${lastAction ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>

                <div className="flex flex-col gap-3 mb-6">
                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl">
                        <span className="text-2xl font-black">ACT</span>
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase">Last Action</p>
                            <p className="text-white font-black text-sm">{lastAction ?? 'WAITING'}</p>
                        </div>
                    </div>
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
