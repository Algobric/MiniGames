/**
 * MeteorRain - Dodge the falling meteors!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

const GAME_DURATION = 20
const PLAYER_SPEED = 8

interface Meteor {
    id: string
    x: number
    speed: number
    spawnTime: number // Elapsed game time when spawned
}

interface MeteorRainState {
    meteors: Meteor[]
    playerPositions: Map<string, number>
    alive: Set<string>
}

const MeteorRain = () => {
    const engine = useMinigameEngine<MeteorRainState>({
        config: {
            countdownDuration: 3,
            gameDuration: GAME_DURATION
        },
        initialGameState: {
            meteors: [],
            playerPositions: new Map(),
            alive: new Set()
        },
        gameReducer: (state, event) => {
            if (event.type === 'SPAWN_METEOR') {
                const { meteor } = event as any
                return {
                    ...state,
                    meteors: [...state.meteors, meteor]
                }
            }
            if (event.type === 'MOVE_PLAYER') {
                const { x } = event as any
                const newPositions = new Map(state.playerPositions)
                newPositions.set(event.senderId, x)
                return { ...state, playerPositions: newPositions }
            }
            if (event.type === 'PLAYER_HIT') {
                const newAlive = new Set(state.alive)
                newAlive.delete(event.senderId)
                return { ...state, alive: newAlive }
            }
            if (event.type === 'INIT_GAME') {
                // Initialize players
                const { playerIds } = event as any
                return {
                    ...state,
                    alive: new Set(playerIds),
                    playerPositions: new Map(playerIds.map((id: string) => [id, 50]))
                }
            }
            return state
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
        endGame,
        dispatchGameEvent
    } = engine

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const [localPlayerX, setLocalPlayerX] = useState(50)
    const gameEndedRef = useRef(false)
    const meteorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Init Logic (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (players.length > 0 && gameState.alive.size === 0 && isPlaying && isLeader) {
            dispatchGameEvent('INIT_GAME', { playerIds: players.map(p => p.id) })
        }
    }, [players, isPlaying, gameState.alive.size, dispatchGameEvent, currentPlayerId])

    // Leader Spawn Logic
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isPlaying || !isLeader || winnerId) {
            if (meteorIntervalRef.current) clearInterval(meteorIntervalRef.current)
            return
        }

        meteorIntervalRef.current = setInterval(() => {
            const now = GAME_DURATION - (timeRemaining || GAME_DURATION)

            // We can cleanup old meteors in UI or Reducer? 
            // Better to cleanup in Reducer occasionally or just ignore them.

            const newMeteor: Meteor = {
                id: `m_${Date.now()}_${Math.random()}`,
                x: Math.random() * 90 + 5,
                speed: 30 + Math.random() * 20,
                spawnTime: now
            }

            dispatchGameEvent('SPAWN_METEOR', { meteor: newMeteor })

        }, 400) // Spawn every 400ms

        return () => { if (meteorIntervalRef.current) clearInterval(meteorIntervalRef.current) }
    }, [isPlaying, winnerId, timeRemaining, dispatchGameEvent, players, currentPlayerId])

    // Client Collision & Movement Logic
    useEffect(() => {
        if (!isPlaying || !currentPlayerId || !gameState.alive.has(currentPlayerId) || winnerId) return

        const interval = setInterval(() => {
            const now = GAME_DURATION - (timeRemaining || GAME_DURATION)
            const myX = localPlayerX
            let hit = false

            for (const m of gameState.meteors) {
                const elapsed = now - m.spawnTime
                const y = -10 + (m.speed * elapsed)

                // Hitbox Y intersection
                if (y > 80 && y < 95) {
                    // Hitbox X
                    const dist = Math.abs(m.x - myX)
                    if (dist < 5) {
                        hit = true
                        break
                    }
                }
            }

            if (hit) {
                playFail()
                dispatchGameEvent('PLAYER_HIT', {})
            }

        }, 50)

        return () => clearInterval(interval)
    }, [isPlaying, currentPlayerId, gameState.meteors, gameState.alive, timeRemaining, localPlayerX, dispatchGameEvent, winnerId])

    // Game Over Logic
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isPlaying || !isLeader || winnerId || gameEndedRef.current) return

        const aliveCount = gameState.alive.size
        const timeOut = timeRemaining !== null && timeRemaining <= 0

        if (aliveCount <= 1 && players.length > 1) {
            const winner = [...gameState.alive][0] || null
            gameEndedRef.current = true
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        } else if (aliveCount === 0 && players.length === 1) {
            gameEndedRef.current = true
            endGame(null)
        } else if (timeOut) {
            gameEndedRef.current = true
            const survivors = [...gameState.alive]
            const winner = survivors.length > 0 ? survivors[0] : null
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        }

    }, [gameState.alive, players.length, timeRemaining, isPlaying, winnerId, currentPlayerId, endGame])


    const handleMove = useCallback((direction: 'left' | 'right') => {
        if (!isPlaying || !currentPlayerId || !gameState.alive.has(currentPlayerId)) return

        playTap()
        setLocalPlayerX(prev => {
            const next = direction === 'left'
                ? Math.max(5, prev - PLAYER_SPEED)
                : Math.min(95, prev + PLAYER_SPEED)

            dispatchGameEvent('MOVE_PLAYER', { x: next })

            return next
        })

    }, [isPlaying, currentPlayerId, gameState.alive, dispatchGameEvent])

    const currentTime = GAME_DURATION - (timeRemaining || GAME_DURATION)

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-gray-900 to-black"
        >
            <div className="flex flex-col items-center justify-between w-full h-full select-none overflow-hidden relative">
                <div className="text-center pt-2 z-10">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        ☄️ METEOR RAIN!
                    </h1>
                    {isPlaying && <div className="text-white/70">Alive: {gameState.alive.size}</div>}
                </div>

                {/* Game Area */}
                <div className="relative flex-1 w-full overflow-hidden">
                    {/* Meteors */}
                    {gameState.meteors.map(m => {
                        const elapsed = currentTime - m.spawnTime
                        const y = -10 + (m.speed * elapsed)
                        if (y > 120) return null // Off screen

                        return (
                            <div
                                key={m.id}
                                className="absolute rounded-full bg-orange-500"
                                style={{
                                    left: `${m.x}%`,
                                    top: `${y}%`,
                                    width: '30px',
                                    height: '30px',
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: '0 0 15px #FF6600'
                                }}
                            >
                                <div className="absolute inset-1 rounded-full bg-yellow-300" />
                            </div>
                        )
                    })}

                    {/* Ground */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-900 to-green-800" />

                    {/* Players */}
                    {players.map((p) => {
                        const isMe = p.id === currentPlayerId
                        // Use local X for me to be instant, global for others
                        const x = isMe ? localPlayerX : (gameState.playerPositions.get(p.id) || 50)
                        const isAlive = gameState.alive.has(p.id) || (gameState.alive.size === 0 && isPlaying)

                        return (
                            <motion.div
                                key={p.id}
                                animate={{ left: `${x}%`, opacity: isAlive ? 1 : 0.3 }}
                                className="absolute bottom-16"
                                style={{ transform: 'translateX(-50%)' }}
                            >
                                <div className={clsx("text-3xl", isMe && "drop-shadow-[0_0_10px_white]")}>
                                    {isAlive ? '🏃' : '💀'}
                                </div>
                                <div className="text-xs text-center mt-1 text-white truncate w-20">
                                    {p.username}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Controls */}
                {isPlaying && currentPlayerId && gameState.alive.has(currentPlayerId) && (
                    <div className="flex gap-8 pb-8 z-10">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onPointerDown={() => handleMove('left')}
                            className="w-24 h-24 bg-gray-700 rounded-xl text-3xl shadow-lg border-b-4 border-gray-900"
                        >
                            ⬅️
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onPointerDown={() => handleMove('right')}
                            className="w-24 h-24 bg-gray-700 rounded-xl text-3xl shadow-lg border-b-4 border-gray-900"
                        >
                            ➡️
                        </motion.button>
                    </div>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default MeteorRain
