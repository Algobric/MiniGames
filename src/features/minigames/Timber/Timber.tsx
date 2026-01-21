/**
 * Timber - Dodge falling branches!
 * Branches fall from the sky, dodge LEFT or RIGHT to survive.
 * First to survive 30 seconds or last one standing wins!
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare } from '../HighNoon/sounds'

type Side = 'LEFT' | 'RIGHT' | 'NONE'

interface FallingBranch {
    id: number
    side: Side  // Where the branch is (dodge to opposite side)
    y: number   // 0 = top, 100 = bottom
}

interface TimberPlayer {
    playerId: string
    side: Side  // Current position (LEFT or RIGHT)
    alive: boolean
    score: number
}

interface TimberState {
    branches: FallingBranch[]
    players: TimberPlayer[]
    nextBranchId: number
}

// Helper
const getPlayer = (players: TimberPlayer[], playerId: string) =>
    players.find(p => p.playerId === playerId)

const GAME_DURATION = 20000 // 20 seconds

const Timber = () => {
    const engine = useMinigameEngine<TimberState>({
        config: {
            countdownDuration: 3,
            gameDuration: GAME_DURATION
        },
        initialGameState: {
            branches: [],
            players: [],
            nextBranchId: 0
        },
        gameReducer: (state, event) => {
            const players = Array.isArray(state.players) ? state.players : []
            const branches = Array.isArray(state.branches) ? state.branches : []

            if (event.type === 'MOVE') {
                const { side } = event as any
                const playerIdx = players.findIndex(p => p.playerId === event.senderId)
                if (playerIdx === -1) return state

                const p = players[playerIdx]
                if (!p.alive) return state

                let nextPlayers = [...players]
                nextPlayers[playerIdx] = { ...p, side }
                return { ...state, players: nextPlayers }
            }

            if (event.type === 'SPAWN_BRANCH') {
                const { branchSide, branchId } = event as any
                const newBranch: FallingBranch = {
                    id: branchId,
                    side: branchSide,
                    y: 0
                }
                return {
                    ...state,
                    branches: [...branches, newBranch],
                    nextBranchId: branchId + 1
                }
            }

            if (event.type === 'UPDATE_BRANCHES') {
                const { updatedBranches, killedPlayers } = event as any
                let nextPlayers = [...players]

                // Mark killed players
                for (const pid of killedPlayers) {
                    const idx = nextPlayers.findIndex(p => p.playerId === pid)
                    if (idx >= 0) {
                        nextPlayers[idx] = { ...nextPlayers[idx], alive: false }
                    }
                }

                // Update surviving players' scores
                for (let i = 0; i < nextPlayers.length; i++) {
                    if (nextPlayers[i].alive) {
                        nextPlayers[i] = { ...nextPlayers[i], score: nextPlayers[i].score + 1 }
                    }
                }

                return { ...state, branches: updatedBranches, players: nextPlayers }
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
        updateGameState,
        endGame,
        timeRemaining,
        dispatchGameEvent
    } = engine

    // Safe access
    const timberPlayers = Array.isArray(gameState.players) ? gameState.players : []
    const branches = Array.isArray(gameState.branches) ? gameState.branches : []

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const gameEndedRef = useRef(false)

    // Init Players
    useEffect(() => {
        if (players.length > 0 && timberPlayers.length === 0 && isPlaying) {
            const newPlayers: TimberPlayer[] = players.map((p, i) => ({
                playerId: p.id,
                side: i === 0 ? 'LEFT' : 'RIGHT',
                alive: true,
                score: 0
            }))

            updateGameState(state => ({
                ...state,
                players: newPlayers,
                branches: [],
                nextBranchId: 0
            }))
        }
    }, [players, isPlaying, timberPlayers.length, updateGameState])

    // Leader spawns branches
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return
        if (timberPlayers.length === 0) return

        const spawnInterval = setInterval(() => {
            const branchSide: Side = Math.random() > 0.5 ? 'LEFT' : 'RIGHT'
            dispatchGameEvent('SPAWN_BRANCH', {
                branchSide,
                branchId: gameState.nextBranchId || 0
            })
        }, 800) // Spawn every 800ms

        return () => clearInterval(spawnInterval)
    }, [isPlaying, isLeader, winnerId, timberPlayers.length, dispatchGameEvent, gameState.nextBranchId])

    // Leader updates branch positions and checks collisions
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return
        if (timberPlayers.length === 0) return

        const updateInterval = setInterval(() => {
            const killedPlayers: string[] = []

            const updatedBranches = branches
                .map(b => ({ ...b, y: b.y + 8 })) // Move down
                .filter(b => {
                    // Check collision at y ~= 85 (hit zone)
                    if (b.y >= 80 && b.y <= 95) {
                        for (const p of timberPlayers) {
                            if (p.alive && p.side === b.side) {
                                // Player is on same side as branch - they die!
                                killedPlayers.push(p.playerId)
                            }
                        }
                    }
                    return b.y < 100 // Remove branches that passed
                })

            // Always dispatch to keep branches moving smoothly
            dispatchGameEvent('UPDATE_BRANCHES', { updatedBranches, killedPlayers })
        }, 50)

        return () => clearInterval(updateInterval)
    }, [isPlaying, isLeader, winnerId, branches, timberPlayers, dispatchGameEvent])

    // Game End Check
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId || gameEndedRef.current) return
        if (timberPlayers.length === 0) return

        const alivePlayers = timberPlayers.filter(p => p.alive)

        // Check if only one left
        if (alivePlayers.length <= 1 && players.length > 1) {
            gameEndedRef.current = true
            const winner = alivePlayers[0]?.playerId || null
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
            return
        }

        // Check if time ran out
        if (timeRemaining !== null && timeRemaining <= 0) {
            gameEndedRef.current = true
            // Highest score wins
            const sorted = [...alivePlayers].sort((a, b) => b.score - a.score)
            const winner = sorted[0]?.playerId || null
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        }
    }, [timberPlayers, players.length, timeRemaining, isPlaying, isLeader, winnerId, currentPlayerId, endGame])

    const handleMove = useCallback((side: Side) => {
        if (!isPlaying || !currentPlayerId) return
        const myP = getPlayer(timberPlayers, currentPlayerId)
        if (!myP?.alive) return

        playTap()
        dispatchGameEvent('MOVE', { side })
    }, [isPlaying, currentPlayerId, timberPlayers, dispatchGameEvent])

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                handleMove('LEFT')
            } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                handleMove('RIGHT')
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleMove])

    const myState = getPlayer(timberPlayers, currentPlayerId || '')

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-sky-400 to-green-600"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🪓 TIMBER!
                    </h1>
                    <p className="text-white/70 text-sm">Dodge left or right!</p>
                </div>

                {/* Game Area */}
                <div className="flex-1 relative w-full max-w-md overflow-hidden bg-amber-900/30 rounded-xl border-4 border-amber-800">
                    {/* Tree trunk in center */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-16 -translate-x-1/2 bg-amber-800" />

                    {/* Falling branches */}
                    {branches.map(b => (
                        <motion.div
                            key={b.id}
                            className={clsx(
                                "absolute h-6 bg-green-700 rounded-full",
                                b.side === 'LEFT' ? "left-4 right-1/2 mr-8" : "right-4 left-1/2 ml-8"
                            )}
                            style={{ top: `${b.y}%` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        />
                    ))}

                    {/* Hit zone indicator */}
                    <div className="absolute left-0 right-0 bottom-[10%] h-1 bg-red-500/50" />

                    {/* Players */}
                    {timberPlayers.map((p) => {
                        const pName = players.find(pl => pl.id === p.playerId)?.username || '?'
                        const isMe = p.playerId === currentPlayerId
                        return (
                            <motion.div
                                key={p.playerId}
                                animate={{
                                    x: p.side === 'LEFT' ? -60 : 60,
                                    opacity: p.alive ? 1 : 0.3
                                }}
                                className={clsx(
                                    "absolute bottom-[5%] left-1/2 -translate-x-1/2 text-center",
                                    isMe ? "z-10" : "z-0"
                                )}
                            >
                                <div className={clsx(
                                    "text-4xl",
                                    !p.alive && "grayscale"
                                )}>
                                    {p.alive ? '🧍' : '💀'}
                                </div>
                                <div className={clsx(
                                    "text-xs mt-1 px-2 py-0.5 rounded",
                                    isMe ? "bg-blue-500 text-white" : "bg-white/50 text-black"
                                )}>
                                    {pName}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Scores */}
                <div className="flex gap-4 mt-2">
                    {timberPlayers.map(p => {
                        const pName = players.find(pl => pl.id === p.playerId)?.username || '?'
                        return (
                            <div key={p.playerId} className={clsx(
                                "text-center px-3 py-1 rounded",
                                p.playerId === currentPlayerId ? "bg-blue-500/50" : "bg-white/20"
                            )}>
                                <div className="text-sm text-white">{pName}</div>
                                <div className="text-lg font-pixel text-white">{p.score}</div>
                            </div>
                        )
                    })}
                </div>

                {/* Controls */}
                {myState?.alive && isPlaying && (
                    <div className="flex gap-8 pb-4 mt-4">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleMove('LEFT')}
                            className={clsx(
                                "w-24 h-24 rounded-full text-4xl shadow-lg border-b-4",
                                myState.side === 'LEFT'
                                    ? "bg-blue-500 border-blue-700"
                                    : "bg-white/20 border-white/50"
                            )}
                        >
                            ⬅️
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleMove('RIGHT')}
                            className={clsx(
                                "w-24 h-24 rounded-full text-4xl shadow-lg border-b-4",
                                myState.side === 'RIGHT'
                                    ? "bg-blue-500 border-blue-700"
                                    : "bg-white/20 border-white/50"
                            )}
                        >
                            ➡️
                        </motion.button>
                    </div>
                )}

                {myState && !myState.alive && (
                    <div className="text-red-400 font-pixel text-xl pb-4">💀 YOU DIED!</div>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default Timber
