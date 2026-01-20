/**
 * Timber - Chop fast, don't get hit!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

type Side = 'LEFT' | 'RIGHT'

interface TimberPlayer {
    playerId: string
    progress: number
    side: Side
    alive: boolean
}

interface TimberState {
    branches: Side[]
    players: TimberPlayer[]  // Changed from Map to array
}

// Helper functions
const getPlayer = (players: TimberPlayer[], playerId: string) =>
    players.find(p => p.playerId === playerId)

const Timber = () => {
    const engine = useMinigameEngine<TimberState>({
        config: {
            countdownDuration: 3,
        },
        initialGameState: {
            branches: [],
            players: []
        },
        gameReducer: (state, event) => {
            const players = Array.isArray(state.players) ? state.players : []

            if (event.type === 'CHOP') {
                const { side } = event as any
                const playerIdx = players.findIndex(p => p.playerId === event.senderId)
                if (playerIdx === -1) return state

                const p = players[playerIdx]
                if (!p.alive) return state

                const currentBranch = state.branches[p.progress]
                let nextPlayers = [...players]

                if (currentBranch === side) {
                    // Hit the branch - die
                    nextPlayers[playerIdx] = { ...p, side, alive: false }
                } else {
                    // Safe - progress
                    nextPlayers[playerIdx] = { ...p, side, progress: p.progress + 1 }
                }
                return { ...state, players: nextPlayers }
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
        dispatchGameEvent
    } = engine

    // Safe access
    const timberPlayers = Array.isArray(gameState.players) ? gameState.players : []

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const GOAL = 50

    // Init Level
    useEffect(() => {
        if (players.length > 0 && gameState.branches.length === 0 && isPlaying) {
            const newBranches: Side[] = []
            for (let i = 0; i < GOAL + 10; i++) newBranches.push(Math.random() > 0.5 ? 'LEFT' : 'RIGHT')

            const newPlayers: TimberPlayer[] = players.map(p => ({
                playerId: p.id,
                progress: 0,
                side: 'LEFT' as Side,
                alive: true
            }))

            updateGameState(state => ({
                ...state,
                branches: newBranches,
                players: newPlayers
            }))
        }
    }, [players, isPlaying, gameState.branches.length, updateGameState])

    // Game End Check
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return
        // Wait until players are initialized
        if (timberPlayers.length === 0) return

        let allDead = true
        let winner = null

        for (const p of timberPlayers) {
            if (p.alive) allDead = false
            if (p.progress >= GOAL && p.alive) {
                winner = p.playerId
                break
            }
        }

        if (winner) {
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        } else if (allDead) {
            // All players dead - no winner
            endGame(null)
        }

    }, [timberPlayers, isPlaying, isLeader, winnerId, currentPlayerId, endGame])


    const handleChop = useCallback((side: Side) => {
        if (!isPlaying || !currentPlayerId) return

        // Check locally for death to play sound immediately
        const myP = getPlayer(timberPlayers, currentPlayerId)
        if (myP && myP.alive) {
            const currentBranch = gameState.branches[myP.progress]
            if (currentBranch === side) {
                playFail()
            } else {
                playTap()
            }
        }

        dispatchGameEvent('CHOP', { side })

    }, [isPlaying, currentPlayerId, dispatchGameEvent, timberPlayers, gameState.branches])

    const myState = getPlayer(timberPlayers, currentPlayerId || '')
    const myProgress = myState?.progress || 0
    // Visible branches: slice from myProgress
    const visibleBranches = gameState.branches.slice(myProgress, myProgress + 6)

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-sky-400 to-green-600"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🪓 TIMBER!
                    </h1>
                </div>

                {/* Game View */}
                <div className="flex-1 flex flex-col items-center justify-end pb-8 relative w-full overflow-hidden">
                    {/* Tree Trunk */}
                    <div className="w-24 bg-amber-800 h-full relative flex flex-col-reverse justify-start">
                        {visibleBranches.map((side, i) => (
                            <motion.div
                                key={myProgress + i}
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="w-full h-24 border-b border-black/10 relative"
                            >
                                {/* Branch */}
                                <div
                                    className={clsx("absolute w-24 h-8 bg-green-800 top-8", side === 'LEFT' ? "-left-20 rounded-l-full" : "-right-20 rounded-r-full")}
                                />
                            </motion.div>
                        ))}
                    </div>

                    {/* Player */}
                    {myState && (
                        <motion.div
                            animate={{ x: myState.side === 'LEFT' ? -80 : 80 }}
                            className="absolute bottom-24 text-6xl"
                        >
                            {myState.alive ? '👷' : '🪦'}
                        </motion.div>
                    )}
                </div>

                {/* Progress */}
                <div className="absolute top-20 right-4 bg-black/30 p-2 rounded text-white">
                    {timberPlayers.map((p, i) => {
                        const pName = players.find(pl => pl.id === p.playerId)?.username
                        return (
                            <div key={i} className="text-xs">
                                {pName}: {p.progress}/{GOAL} {p.alive ? '' : '💀'}
                            </div>
                        )
                    })}
                </div>

                {/* Controls */}
                {myState?.alive && isPlaying && (
                    <div className="flex gap-16 pb-8 z-10">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onPointerDown={() => handleChop('LEFT')}
                            className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-full text-4xl shadow-lg border-b-4 border-white/50"
                        >
                            ⬅️
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onPointerDown={() => handleChop('RIGHT')}
                            className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-full text-4xl shadow-lg border-b-4 border-white/50"
                        >
                            ➡️
                        </motion.button>
                    </div>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default Timber
