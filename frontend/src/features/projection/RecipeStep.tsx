import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RecipeStepProps {
    stepNumber: number;
    instruction: string;
}

export const RecipeStep: React.FC<RecipeStepProps> = ({ stepNumber, instruction }) => {
    return (
        <div className="absolute top-20 left-20 max-w-4xl z-10">
            <AnimatePresence mode="wait">
                <motion.div
                    key={stepNumber}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6 tracking-tighter">
                        STEP {stepNumber}
                    </h1>
                    <p className="text-5xl font-medium text-white leading-snug drop-shadow-lg">
                        {instruction}
                    </p>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
