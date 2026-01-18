import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { getMinigamesByCategory } from '../minigames/MinigameRegistry'
import clsx from 'clsx'

interface MinigameSelectorProps {
    onSelect: (gameId: string) => void
    onCancel: () => void
    playerCount: number
}

export const MinigameSelector: React.FC<MinigameSelectorProps> = ({ onSelect, onCancel, playerCount }) => {
    const categories = useMemo(() => getMinigamesByCategory(), [])
    const [selectedCategory, setSelectedCategory] = useState<string>('Reaction & Speed')

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-6xl h-full max-h-[90vh] bg-gray-900 border-2 border-atari-green rounded-xl overflow-hidden shadow-[0_0_50px_rgba(57,255,20,0.2)] flex flex-col"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/50">
                    <div>
                        <h2 className="text-3xl font-pixel text-atari-green" style={{ textShadow: '0 0 10px #39ff14' }}>
                            SELECT MINIGAME
                        </h2>
                        <p className="text-white/50 text-sm mt-1">
                            Choose a game to play immediately
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Categories */}
                    <div className="w-64 bg-black/30 border-r border-white/10 flex flex-col overflow-y-auto">
                        {Object.keys(categories).map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={clsx(
                                    "px-6 py-4 text-left font-pixel transition-colors hover:bg-white/5",
                                    selectedCategory === category
                                        ? "text-atari-yellow bg-white/10 border-l-4 border-atari-yellow"
                                        : "text-white/70 border-l-4 border-transparent"
                                )}
                            >
                                {category.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Games Grid */}
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {categories[selectedCategory]?.map(({ id, entry }) => {
                                const isPlayable = playerCount >= entry.minPlayers && playerCount <= entry.maxPlayers

                                return (
                                    <motion.button
                                        key={id}
                                        onClick={() => isPlayable && onSelect(id)}
                                        whileHover={isPlayable ? { scale: 1.02, y: -5 } : {}}
                                        whileTap={isPlayable ? { scale: 0.98 } : {}}
                                        className={clsx(
                                            "relative group text-left rounded-xl border-2 p-4 transition-all h-full flex flex-col",
                                            isPlayable
                                                ? "bg-white/5 border-white/10 hover:border-atari-cyan hover:shadow-[0_0_20px_rgba(0,255,255,0.2)]"
                                                : "bg-black/40 border-white/5 opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <div className="text-5xl mb-4">{entry.icon}</div>
                                        <h3 className={clsx(
                                            "font-pixel text-xl mb-2",
                                            isPlayable ? "text-white group-hover:text-atari-cyan" : "text-white/50"
                                        )}>
                                            {entry.name}
                                        </h3>
                                        <p className="text-sm text-white/60 mb-4 flex-1">
                                            {entry.instructions}
                                        </p>

                                        <div className="flex justify-between items-center text-xs font-mono uppercase">
                                            <span className={isPlayable ? "text-atari-green" : "text-red-500"}>
                                                {entry.minPlayers}-{entry.maxPlayers} PLAYERS
                                            </span>
                                            {!isPlayable && (
                                                <span className="text-red-400 font-bold">
                                                    Need {entry.minPlayers}+
                                                </span>
                                            )}
                                        </div>

                                        {/* Play Button Overlay */}
                                        {isPlayable && (
                                            <div className="absolute inset-x-0 bottom-0 top-0 bg-atari-cyan/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                                                <div className="bg-black/80 px-4 py-2 rounded-full text-atari-cyan font-pixel">
                                                    PLAY NOW
                                                </div>
                                            </div>
                                        )}
                                    </motion.button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
