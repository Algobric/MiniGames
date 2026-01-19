/**
 * MinigameWrapper - Shared wrapper for all minigames
 * 
 * Provides:
 * - Consistent loading states
 * - Error boundaries
 * - Audio unlock handling
 * - Common layout structure
 */

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../context/GameContext'
import type { MinigamePhase } from './types'
import { unlockAudio } from '../features/minigames/HighNoon/sounds'

interface MinigameWrapperProps {
    children: React.ReactNode
    phase: MinigamePhase
    countdown: number
    winnerId: string | null
    winnerName?: string
    backgroundColor?: string
    showCountdown?: boolean
}

export function MinigameWrapper({
    children,
    phase,
    countdown,
    winnerId,
    winnerName,
    backgroundColor = 'bg-atari-black',
    showCountdown = true
}: MinigameWrapperProps) {
    const { players, currentPlayer } = useGame()
    const [audioUnlocked, setAudioUnlocked] = useState(false)

    useEffect(() => {
        const handleInteraction = () => {
            unlockAudio()
            setAudioUnlocked(true)
            window.removeEventListener('pointerdown', handleInteraction)
        }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    const displayWinnerName = winnerName || players.find(p => p.id === winnerId)?.username || 'Unknown'
    const isWinner = winnerId === currentPlayer?.id

    return (
        <div className={`relative w-full h-full ${backgroundColor} overflow-hidden select-none`}>
            <AnimatePresence>
                {phase === 'COUNTDOWN' && showCountdown && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
                    >
                        <motion.div
                            key={countdown}
                            initial={{ scale: 2, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="text-9xl font-pixel text-atari-yellow"
                            style={{ textShadow: '0 0 40px #FFD700' }}
                        >
                            {countdown > 0 ? countdown : 'GO!'}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {(phase === 'ENDING' || phase === 'ENDED') && winnerId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
                    >
                        <div className="text-center">
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 10 }}
                                className="text-8xl mb-6"
                            >
                                {isWinner ? '🏆' : '😢'}
                            </motion.div>
                            <motion.div
                                initial={{ y: 30, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className={`text-4xl md:text-6xl font-pixel ${isWinner ? 'text-atari-green' : 'text-white'}`}
                                style={{ textShadow: '0 0 20px currentColor' }}
                            >
                                {displayWinnerName} WINS!
                            </motion.div>
                            {isWinner && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="mt-4 text-2xl text-atari-cyan"
                                >
                                    +100 POINTS
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {(phase === 'ENDING' || phase === 'ENDED') && !winnerId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
                    >
                        <div className="text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-8xl mb-6"
                            >
                                🤝
                            </motion.div>
                            <div className="text-4xl font-pixel text-gray-400">
                                DRAW!
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!audioUnlocked && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm animate-pulse z-10">
                    Tap anywhere to enable sound
                </div>
            )}

            <div className="relative w-full h-full z-0">
                {children}
            </div>
        </div>
    )
}

interface PlayerScoreBarProps {
    username: string
    value: number
    maxValue: number
    isCurrentPlayer: boolean
    color?: string
}

export function PlayerScoreBar({
    username,
    value,
    maxValue,
    isCurrentPlayer,
    color = 'bg-atari-green'
}: PlayerScoreBarProps) {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-1">
                <span className={`font-pixel text-sm ${isCurrentPlayer ? 'text-atari-green' : 'text-white'}`}>
                    {username}
                </span>
                <span className="font-mono text-xl text-atari-cyan">
                    {value}
                </span>
            </div>
            <div className="h-6 bg-gray-800 rounded-full overflow-hidden border-2 border-gray-600">
                <motion.div
                    className={`h-full rounded-full ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ type: 'spring', damping: 20 }}
                    style={{ boxShadow: `0 0 10px currentColor` }}
                />
            </div>
        </div>
    )
}
