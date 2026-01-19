/**
 * TargetShoot - Reflexes!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import { playTap, playWinFanfare } from '../HighNoon/sounds'

interface Target {
    id: string
    x: number
    y: number
    size: number
}

interface TargetState {
    targets: Target[]
    scores: Map<string, number>
}

const TargetShoot = () => {
    const engine = useMinigameEngine<TargetState>({
        config: {
            countdownDuration: 3,
            gameDuration: 30
        },
        initialGameState: {
            targets: [],
            scores: new Map()
        }
    })

    const {
        phase,
        countdown,
        gameState,
        winnerId,
        isPlaying,
        currentPlayerId,
        players,
        updateGameState,
        endGame,
        timeRemaining
    } = engine

    const isLeader = players.length > 0 && players[0].id === currentPlayerId

    // Spawn Logic
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return

        const interval = setInterval(() => {
            if (gameState.targets.length < 5) { // Maintain targets
                updateGameState(state => {
                    const newTarget: Target = {
                        id: Math.random().toString(36),
                        x: 10 + Math.random() * 80,
                        y: 10 + Math.random() * 80,
                        size: 40 + Math.random() * 40
                    }
                    return { ...state, targets: [...state.targets, newTarget] }
                })
            }
        }, 800)
        return () => clearInterval(interval)
    }, [isPlaying, isLeader, winnerId, gameState.targets.length, updateGameState])

    // Game End
    useEffect(() => {
        if (timeRemaining !== null && timeRemaining <= 0 && isPlaying && isLeader && !winnerId) {
            const sorted = [...gameState.scores.entries()].sort((a, b) => b[1] - a[1])
            const winner = sorted[0]?.[0]
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        }
    }, [timeRemaining, isPlaying, isLeader, winnerId, gameState.scores, currentPlayerId, endGame])

    const handleHit = useCallback((t: Target) => {
        if (!isPlaying || !currentPlayerId) return

        playTap()
        // Optimistic Remove? No, wait for state for fairness, but sound immediate.
        // Actually, for responsiveness, we could hide locally?
        // Let's just send update.
        updateGameState(state => {
            // Verify target still exists
            if (!state.targets.find(tg => tg.id === t.id)) return state

            const points = Math.round(100 / t.size * 10)
            const newScores = new Map(state.scores)
            newScores.set(currentPlayerId, (newScores.get(currentPlayerId) || 0) + points)

            return {
                ...state,
                targets: state.targets.filter(tg => tg.id !== t.id),
                scores: newScores
            }
        })
    }, [isPlaying, currentPlayerId, updateGameState])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-gray-800 to-gray-900"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none touch-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🎯 TARGET SHOOT
                    </h1>
                </div>

                {/* Game Area */}
                <div className="relative flex-1 w-full bg-black/20 rounded-xl overflow-hidden cursor-crosshair border-2 border-white/10">
                    {gameState.targets.map(t => (
                        <motion.button
                            key={t.id}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute rounded-full border-2 border-white bg-red-500 shadow-xl"
                            style={{
                                left: `${t.x}%`,
                                top: `${t.y}%`,
                                width: t.size,
                                height: t.size,
                                transform: 'translate(-50%, -50%)'
                            }}
                            onPointerDown={() => handleHit(t)}
                        >
                            <div className="w-full h-full rounded-full border-[6px] border-white/30" />
                        </motion.button>
                    ))}
                </div>

                {/* Scores */}
                <div className="flex gap-4 pb-4 overflow-x-auto w-full justify-center">
                    {players.map(p => (
                        <div key={p.id} className="bg-gray-700 px-3 py-1 rounded text-white text-sm whitespace-nowrap">
                            {p.username}: {gameState.scores.get(p.id) || 0}
                        </div>
                    ))}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default TargetShoot
