/**
 * SumoSlap - Push them out!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare } from '../HighNoon/sounds'

const ARENA_RADIUS = 120
const SUMO_RADIUS = 25
const PUSH_FORCE = 8
const MASS_GAIN = 5

interface SumoPlayer {
    id: string
    x: number
    y: number
    mass: number
    alive: boolean
    vx: number
    vy: number
}

interface SumoState {
    players: Map<string, SumoPlayer> // All data in state for ease of access
    aliveCount: number
}

const SumoSlap = () => {
    const engine = useMinigameEngine<SumoState>({
        config: {
            countdownDuration: 3,
            gameDuration: 30
        },
        initialGameState: {
            players: new Map(),
            aliveCount: 0
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
    const physicsInterval = useRef<ReturnType<typeof setInterval> | null>(null)

    // Initialize Players
    useEffect(() => {
        if (players.length > 0 && gameState.players.size === 0 && isPlaying) {
            const newPlayers = new Map<string, SumoPlayer>()
            players.forEach((p, i) => {
                const angle = (i / players.length) * Math.PI * 2
                // Start slightly apart
                newPlayers.set(p.id, {
                    id: p.id,
                    x: Math.cos(angle) * 50,
                    y: Math.sin(angle) * 50,
                    vx: 0,
                    vy: 0,
                    mass: 30,
                    alive: true
                })
            })

            updateGameState(state => ({
                ...state,
                players: newPlayers,
                aliveCount: players.length
            }))
        }
    }, [players, isPlaying, gameState.players.size, updateGameState])

    // Leader Physics Engine
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId || gameState.players.size === 0) return

        physicsInterval.current = setInterval(() => {
            updateGameState(state => {
                const nextPlayers = new Map(state.players)
                let activeCount = 0

                // 1. Move & Friction
                nextPlayers.forEach(p => {
                    if (!p.alive) return;
                    activeCount++

                    p.x += p.vx
                    p.y += p.vy
                    p.vx *= 0.9 // Friction
                    p.vy *= 0.9

                    // Out of bounds check
                    const dist = Math.sqrt(p.x * p.x + p.y * p.y)
                    if (dist > ARENA_RADIUS - SUMO_RADIUS / 2) {
                        p.alive = false
                    }
                })

                if (activeCount <= 1 && players.length > 1) {
                    // Game Over Trigger inside effect, just update state here
                    return { ...state, players: nextPlayers, aliveCount: activeCount }
                }

                if (activeCount === 0 && players.length === 1) {
                    return { ...state, players: nextPlayers, aliveCount: 0 }
                }

                // 2. Collisions
                const pIds = Array.from(nextPlayers.keys())
                for (let i = 0; i < pIds.length; i++) {
                    const p1 = nextPlayers.get(pIds[i])!
                    if (!p1.alive) continue

                    for (let j = i + 1; j < pIds.length; j++) {
                        const p2 = nextPlayers.get(pIds[j])!
                        if (!p2.alive) continue

                        const dx = p2.x - p1.x
                        const dy = p2.y - p1.y
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        const minDist = (p1.mass + p2.mass) / 2 * 0.8 // Visual overlap allowed

                        if (dist < minDist) {
                            // Push Mechanism
                            const angle = Math.atan2(dy, dx)
                            const force = 2.0 // Bounce factor

                            const nx = Math.cos(angle)
                            const ny = Math.sin(angle)

                            // Exchange momentum? Or just push.
                            // Simple arcade push:
                            p1.vx -= nx * force
                            p1.vy -= ny * force
                            p2.vx += nx * force
                            p2.vy += ny * force

                            // Separate them to avoid sticky
                            const overlap = minDist - dist
                            if (overlap > 0) {
                                p1.x -= nx * overlap * 0.5
                                p1.y -= ny * overlap * 0.5
                                p2.x += nx * overlap * 0.5
                                p2.y += ny * overlap * 0.5
                            }
                        }
                    }
                }

                return { ...state, players: nextPlayers, aliveCount: activeCount }
            })
        }, 50)

        return () => { if (physicsInterval.current) clearInterval(physicsInterval.current) }
    }, [isPlaying, isLeader, winnerId, players.length, updateGameState])

    // Game End Check
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return

        const alive = Array.from(gameState.players.values()).filter(p => p.alive)

        if (players.length > 1 && alive.length <= 1) {
            const winner = alive[0]?.id || null
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        } else if (timeRemaining !== null && timeRemaining <= 0) {
            // Time up - heaviest wins?
            const winner = alive.sort((a, b) => b.mass - a.mass)[0]?.id || null
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        }
    }, [gameState.players, players.length, timeRemaining, isPlaying, isLeader, winnerId, currentPlayerId, endGame])


    // Controls
    const handlePush = useCallback((dir: { x: number, y: number }) => {
        if (!isPlaying || !currentPlayerId) return

        playTap()
        updateGameState(state => {
            const p = state.players.get(currentPlayerId)
            if (!p || !p.alive) return state

            const nextPlayers = new Map(state.players)
            const nextP = { ...p }

            // Add velocity
            nextP.vx += dir.x * PUSH_FORCE
            nextP.vy += dir.y * PUSH_FORCE
            nextP.mass += MASS_GAIN // Get fatter as you move!

            nextPlayers.set(currentPlayerId, nextP)
            return { ...state, players: nextPlayers }
        })
    }, [isPlaying, currentPlayerId, updateGameState])


    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-amber-700 to-amber-900"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🤼 SUMO SLAP!
                    </h1>
                </div>

                {/* Arena */}
                <div className="relative flex items-center justify-center flex-1">
                    <div
                        className="rounded-full bg-amber-500 border-8 border-amber-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                        style={{ width: ARENA_RADIUS * 2, height: ARENA_RADIUS * 2 }}
                    >
                        <div className="w-full h-full rounded-full border-4 border-white/20 opacity-50" />
                    </div>

                    {/* Players */}
                    {Array.from(gameState.players.values()).map(p => {
                        if (!p.alive) return null
                        const myId = currentPlayerId
                        return (
                            <motion.div
                                key={p.id}
                                className={clsx("absolute text-center flex items-center justify-center rounded-full shadow-lg border-2",
                                    p.id === myId ? "border-white bg-blue-600" : "border-black/20 bg-red-600")}
                                animate={{
                                    x: p.x,
                                    y: p.y,
                                    width: p.mass,
                                    height: p.mass
                                }}
                                transition={{ type: 'tween', ease: 'linear', duration: 0.05 }} // Smooth lerp
                            >
                                <span className="text-xl">😠</span>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Controls */}
                {isPlaying && gameState.players.get(currentPlayerId || '')?.alive && (
                    <div className="grid grid-cols-3 gap-2 pb-8">
                        <div />
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handlePush({ x: 0, y: -1 })} className="w-16 h-16 bg-amber-600 rounded-xl text-2xl border-b-4 border-amber-800">⬆️</motion.button>
                        <div />
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handlePush({ x: -1, y: 0 })} className="w-16 h-16 bg-amber-600 rounded-xl text-2xl border-b-4 border-amber-800">⬅️</motion.button>
                        <div />
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handlePush({ x: 1, y: 0 })} className="w-16 h-16 bg-amber-600 rounded-xl text-2xl border-b-4 border-amber-800">➡️</motion.button>
                        <div />
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handlePush({ x: 0, y: 1 })} className="w-16 h-16 bg-amber-600 rounded-xl text-2xl border-b-4 border-amber-800">⬇️</motion.button>
                        <div />
                    </div>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default SumoSlap
