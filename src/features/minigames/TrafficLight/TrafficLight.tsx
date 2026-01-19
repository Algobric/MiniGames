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
        },
        gameReducer: (state, event) => {
            if (event.type === 'CHANGE_LIGHT') {
                const { light } = event as any
                return { ...state, light }
            }
            if (event.type === 'MOVE_PLAYER') {
                const { pos } = event as any
                const newPositions = new Map(state.positions)
                newPositions.set(event.senderId, pos)
                return { ...state, positions: newPositions }
            }
            if (event.type === 'INIT_POSITIONS') {
                const { playerIds } = event as any
                return {
                    ...state,
                    positions: new Map(playerIds.map((id: string) => [id, 0]))
                }
            }
            return state
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
        dispatchGameEvent
    } = engine

    const [isHolding, setIsHolding] = useState(false)
    const gameEndedRef = useRef(false)

    // Init Positions (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (isPlaying && isLeader && gameState.positions.size === 0) {
            dispatchGameEvent('INIT_POSITIONS', { playerIds: players.map(p => p.id) })
        }
    }, [players, isPlaying, gameState.positions.size, dispatchGameEvent, currentPlayerId])

    // Traffic Light Cycle (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isPlaying || !isLeader || winnerId) return

        const duration = Math.random() * 2000 + 1500
        const timeout = setTimeout(() => {
            const nextLight = gameState.light === 'GREEN' ? 'RED' : 'GREEN'
            dispatchGameEvent('CHANGE_LIGHT', { light: nextLight })
        }, duration)

        return () => clearTimeout(timeout)
    }, [gameState.light, isPlaying, winnerId, dispatchGameEvent, players, currentPlayerId])

    // Movement Logic (Local + Sync)
    useEffect(() => {
        if (!isPlaying || !currentPlayerId || !isHolding) return

        const interval = setInterval(() => {
            if (gameState.light === 'GREEN') {
                playTap()

                const currentPos = gameState.positions.get(currentPlayerId) || 0
                const newPos = Math.min(FINISH_LINE, currentPos + 2)

                dispatchGameEvent('MOVE_PLAYER', { pos: newPos })
            } else if (gameState.light === 'RED') {
                // Violation
                playFail()
                setIsHolding(false)
                dispatchGameEvent('MOVE_PLAYER', { pos: 0 })
            }
        }, 100)

        return () => clearInterval(interval)
    }, [isPlaying, isHolding, gameState.light, currentPlayerId, gameState.positions, dispatchGameEvent])

    // Winner Check (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        if (!gameEndedRef.current && gameState.positions.size > 0) {
            gameState.positions.forEach((pos, playerId) => {
                if (pos >= FINISH_LINE && !gameEndedRef.current) {
                    gameEndedRef.current = true
                    playWinFanfare()
                    endGame(playerId)
                }
            })
        }
    }, [gameState.positions, endGame, players, currentPlayerId])

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
