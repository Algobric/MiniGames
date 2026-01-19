/**
 * BalanceBeam - Don't fall off!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

const GAME_DURATION = 20
const GRAVITY = 0.3
const TILT_SPEED = 2

interface BalanceBeamState {
    tiltAngles: Map<string, number>
    alive: Set<string>
}

const BalanceBeam = () => {
    const engine = useMinigameEngine<BalanceBeamState>({
        config: {
            countdownDuration: 3,
            gameDuration: GAME_DURATION
        },
        initialGameState: {
            tiltAngles: new Map(),
            alive: new Set()
        }
    })

    const {
        phase,
        countdown,
        timeRemaining,
        gameState,
        winnerId,
        isPlaying,
        currentPlayerId,
        players,
        updateGameState,
        endGame
    } = engine

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const [localPositions, setLocalPositions] = useState<Map<string, number>>(new Map())
    const velocityRef = useRef<Map<string, number>>(new Map())
    const gameEndedRef = useRef(false)

    // Initialize state
    useEffect(() => {
        if (players.length > 0 && gameState.alive.size === 0 && isPlaying) {
            // We need to initialize alive set if empty
            updateGameState(state => ({
                ...state,
                alive: new Set(players.map(p => p.id)),
                tiltAngles: new Map(players.map(p => [p.id, 0]))
            }))
        }
    }, [players, isPlaying, gameState.alive.size, updateGameState])

    // Physics Loop (Runs on all clients for visuals)
    useEffect(() => {
        if (!isPlaying) return

        const interval = setInterval(() => {
            setLocalPositions(prev => {
                const next = new Map(prev)
                const currentVels = velocityRef.current

                // Iterate over all players (even dead ones for fairness in code, but visuals hide them)
                players.forEach(player => {
                    // Start position is 0 if undefined
                    let pos = prev.get(player.id) ?? 0
                    let vel = currentVels.get(player.id) ?? 0

                    const tilt = gameState.tiltAngles.get(player.id) || 0
                    const isAlive = gameState.alive.has(player.id) || (gameState.alive.size === 0 && isLeader) // during init

                    // Apply gravity
                    vel += Math.sin(tilt * Math.PI / 180) * GRAVITY

                    // Apply random wind (Synced? No, random local wind makes it divergent! 
                    // Let's remove random wind for fairness in deterministic engine, or use deterministic noise)
                    // Removing wind for now to ensure stability.

                    vel *= 0.98 // Friction
                    pos += vel * 0.05 // Speed scale

                    // Guard bounds
                    if (pos > 1.2) pos = 1.2
                    if (pos < -1.2) pos = -1.2

                    next.set(player.id, pos)
                    currentVels.set(player.id, vel)

                    // Fall detection (Leader only updates state, but local can show visual fall)
                    if (Math.abs(pos) > 1 && isLeader && isAlive && !winnerId) {
                        // This player fell
                        updateGameState(state => {
                            const newAlive = new Set(state.alive)
                            newAlive.delete(player.id)
                            return { ...state, alive: newAlive }
                        })
                        // Play fail sound?
                        // Ideally we only play sound if WE fell.
                        if (player.id === currentPlayerId) playFail()
                    }
                })
                return next
            })
        }, 16)

        return () => clearInterval(interval)
    }, [isPlaying, players, gameState.tiltAngles, gameState.alive, isLeader, updateGameState, winnerId, currentPlayerId])

    // Game Over Logic
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId || gameEndedRef.current) return

        // Check if only one survivor (or 0)
        // If single player mode? Then 0 is loss.
        // If multiple, last man standing.

        const aliveCount = gameState.alive.size
        const timeOut = timeRemaining !== null && timeRemaining <= 0

        if (aliveCount <= 1 && players.length > 1) {
            // Winner found
            gameEndedRef.current = true
            const winner = [...gameState.alive][0] || null
            playWinFanfare()
            endGame(winner)
        } else if (aliveCount === 0 && players.length === 1) {
            // Solo loss
            gameEndedRef.current = true
            endGame(null)
        } else if (timeOut) {
            // Time up - Draw or everyone wins? 
            // "Survival" game. Everyone alive wins?
            // Or random winner among survivors? Usually draw. 
            // Or "Tie".
            gameEndedRef.current = true
            // For now, no winner if time runs out (Tie)
            endGame(null)
        }

    }, [gameState.alive, players.length, timeRemaining, isPlaying, isLeader, winnerId, endGame])


    const handleTilt = useCallback((direction: 'left' | 'right') => {
        if (!isPlaying || !currentPlayerId) return
        if (!gameState.alive.has(currentPlayerId)) return

        playTap()
        const currentAngle = gameState.tiltAngles.get(currentPlayerId) || 0
        const newAngle = direction === 'left'
            ? Math.max(-30, currentAngle - TILT_SPEED)
            : Math.min(30, currentAngle + TILT_SPEED)

        updateGameState(state => ({
            ...state,
            tiltAngles: new Map([...state.tiltAngles, [currentPlayerId, newAngle]])
        }))
    }, [isPlaying, currentPlayerId, gameState.alive, gameState.tiltAngles, updateGameState])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-sky-400 to-sky-700"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        ⚖️ BALANCE BEAM!
                    </h1>
                </div>

                {/* Beam Area */}
                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
                    {players.map(player => {
                        const isMe = player.id === currentPlayerId
                        const angle = gameState.tiltAngles.get(player.id) || 0
                        const pos = localPositions.get(player.id) || 0
                        const isAlive = gameState.alive.has(player.id) || (gameState.alive.size === 0 && isLeader) // Show initial state

                        return (
                            <div key={player.id} className={clsx("mb-8 w-full transition-opacity duration-500", !isAlive && "opacity-30 grayscale")}>
                                <div className="text-center text-sm text-white mb-1">{player.username} {isMe ? '(YOU)' : ''}</div>
                                <motion.div
                                    animate={{ rotate: angle }}
                                    className="relative w-full h-4 bg-amber-700 rounded-full mx-auto"
                                    style={{ transformOrigin: 'center' }}
                                >
                                    {/* Pivot */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-900 clip-path-triangle" />

                                    {/* Ball */}
                                    {isAlive && (
                                        <div
                                            className="absolute top-0 w-6 h-6 bg-red-500 rounded-full -translate-y-full shadow-md"
                                            style={{
                                                left: `${50 + pos * 40}%`, // Scale position to %
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                        />
                                    )}
                                </motion.div>
                            </div>
                        )
                    })}
                </div>

                {isPlaying && currentPlayerId && gameState.alive.has(currentPlayerId) && (
                    <div className="flex gap-16 pb-8">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onPointerDown={() => handleTilt('left')}
                            className="w-24 h-24 bg-amber-600 rounded-full shadow-lg text-4xl border-b-8 border-amber-800 active:border-b-0 active:translate-y-2"
                        >
                            ⬅️
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onPointerDown={() => handleTilt('right')}
                            className="w-24 h-24 bg-amber-600 rounded-full shadow-lg text-4xl border-b-8 border-amber-800 active:border-b-0 active:translate-y-2"
                        >
                            ➡️
                        </motion.button>
                    </div>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default BalanceBeam
