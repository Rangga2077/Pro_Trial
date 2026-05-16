import React from 'react';
import { motion } from 'framer-motion';

interface VoiceStatusProps {
    isListening: boolean;
    isProcessing: boolean;
}

export const VoiceStatus: React.FC<VoiceStatusProps> = ({ isListening, isProcessing }) => {
    return (
        <div className="absolute bottom-10 right-10 flex items-center gap-4">
            {isProcessing && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-2xl text-blue-400 font-mono"
                >
                    Processing...
                </motion.div>
            )}
            <div className={`p-4 rounded-full ${isListening ? 'bg-red-500/20 border-2 border-red-500' : 'bg-gray-800/50'}`}>
                <motion.div
                    animate={isListening ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className={`w-4 h-4 rounded-full ${isListening ? 'bg-red-500' : 'bg-gray-500'}`}
                />
            </div>
        </div>
    );
};
