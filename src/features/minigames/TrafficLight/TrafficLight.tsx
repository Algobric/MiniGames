/**
 * TrafficLight - Green light run, Red light stop!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

type Light = 'RED' | 'YELLOW' | 'GREEN'
const FINISH_LINE = 100

interface TrafficLightState {
    light: Light
    positions: Map<string, number>
}

const TrafficLight = () => {
    const engine = useMinigameEngine<TrafficLightState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            light: 'RED',
            positions: new Map()
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
        endGame,
        updateGameState
    } = engine

    const [isHolding, setIsHolding] = useState(false)

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const gameEndedRef = useRef(false)

    // Player position initialization
    useEffect(() => {
        if (players.length > 0 && gameState.positions.size === 0) {
            updateGameState(state => ({
                ...state,
                positions: new Map(players.map(p => [p.id, 0]))
            }))
        }
    }, [players, gameState.positions.size, updateGameState])

    // Actually, triggered cycle:
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return

        const duration = Math.random() * 2000 + 1500
        const timeout = setTimeout(() => {
            updateGameState(state => ({
                ...state,
                light: state.light === 'GREEN' ? 'RED' : 'GREEN'
            }))
        }, duration)

        return () => clearTimeout(timeout)
    }, [gameState.light, isPlaying, isLeader, winnerId, updateGameState])


    // Movement Logic (Local + Sync)
    useEffect(() => {
        if (!isPlaying || !currentPlayerId || !isHolding) return

        const interval = setInterval(() => {
            if (gameState.light === 'GREEN') {
                playTap()
                updateGameState(state => {
                    const currentPos = state.positions.get(currentPlayerId) || 0
                    const newPos = Math.min(FINISH_LINE, currentPos + 2)

                    if (newPos >= FINISH_LINE && !gameEndedRef.current) {
                        gameEndedRef.current = true

                        // We need to trigger win outside reducer to be safe with side effects
                        setTimeout(() => {
                            playWinFanfare()
                            endGame(currentPlayerId)
                        }, 0)
                    }

                    return {
                        ...state,
                        positions: new Map([...state.positions, [currentPlayerId, newPos]])
                    }
                })
            } else if (gameState.light === 'RED') {
                // Violation
                playFail()
                setIsHolding(false)
                updateGameState(state => ({
                    ...state,
                    positions: new Map([...state.positions, [currentPlayerId, 0]])
                }))
            }
        }, 100)

        return () => clearInterval(interval)
    }, [isPlaying, isHolding, gameState.light, currentPlayerId, updateGameState, endGame])

    const handleDown = useCallback(() => setIsHolding(true), [])
    const handleUp = useCallback(() => setIsHolding(false), [])

    const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3']

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-gray-700 to-gray-900"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🚦 TRAFFIC LIGHT!
                    </h1>
                    <p className="text-sm text-white/70">Hold on GREEN, release on RED</p>
                </div>

                {/* Light */}
                <div className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-xl my-4">
                    <motion.div
                        animate={{ scale: gameState.light === 'RED' ? 1.2 : 0.8, opacity: gameState.light === 'RED' ? 1 : 0.3 }}
                        className="w-16 h-16 rounded-full bg-red-600"
                        style={{ boxShadow: gameState.light === 'RED' ? '0 0 30px #FF0000' : 'none' }}
                    />
                    <motion.div
                        animate={{ scale: gameState.light === 'YELLOW' ? 1.2 : 0.8, opacity: gameState.light === 'YELLOW' ? 1 : 0.3 }}
                        className="w-16 h-16 rounded-full bg-yellow-500"
                    />
                    <motion.div
                        animate={{ scale: gameState.light === 'GREEN' ? 1.2 : 0.8, opacity: gameState.light === 'GREEN' ? 1 : 0.3 }}
                        className="w-16 h-16 rounded-full bg-green-500"
                        style={{ boxShadow: gameState.light === 'GREEN' ? '0 0 30px #00FF00' : 'none' }}
                    />
                </div>

                {/* Track */}
                <div className="w-full max-w-md flex-1">
                    {players.map((player, idx) => {
                        const pos = gameState.positions.get(player.id) || 0
                        return (
                            <div key={player.id} className="mb-4">
                                <div className="flex justify-between text-sm text-white mb-1">
                                    <span>{player.username}</span>
                                    <span>{Math.round(pos)}%</span>
                                </div>
                                <div className="relative h-8 bg-gray-600 rounded-full overflow-hidden">
                                    <div className="absolute right-0 w-2 h-full bg-yellow-400" />
                                    <motion.div
                                        animate={{ left: `${pos}%` }}
                                        className="absolute top-1 w-6 h-6 rounded-full"
                                        style={{ backgroundColor: PLAYER_COLORS[idx % PLAYER_COLORS.length] }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Controls */}
                {isPlaying && (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onPointerDown={handleDown}
                        onPointerUp={handleUp}
                        onPointerLeave={handleUp}
                        className={clsx(
                            "px-16 py-8 text-2xl font-pixel rounded-xl shadow-lg mb-4 transition-colors w-full max-w-sm",
                            isHolding ? "bg-green-500" : "bg-gray-600"
                        )}
                    >
                        {isHolding ? '🏃 RUNNING...' : '👆 HOLD TO RUN'}
                    </motion.button>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default TrafficLight
