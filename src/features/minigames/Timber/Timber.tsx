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

interface TimberState {
    branches: Side[] // 0 is bottom, N is top
    players: Map<string, {
        progress: number
        side: Side
        alive: boolean
    }>
}

const Timber = () => {
    const engine = useMinigameEngine<TimberState>({
        config: {
            countdownDuration: 3,
        },
        initialGameState: {
            branches: [],
            players: new Map()
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
        endGame
    } = engine

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const GOAL = 50

    // Init Level
    useEffect(() => {
        if (players.length > 0 && gameState.branches.length === 0 && isPlaying) {
            const newBranches: Side[] = []
            for (let i = 0; i < GOAL + 10; i++) newBranches.push(Math.random() > 0.5 ? 'LEFT' : 'RIGHT')

            const newPlayers = new Map()
            players.forEach(p => newPlayers.set(p.id, { progress: 0, side: 'LEFT', alive: true }))

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

        let allDead = true
        let winner = null

        for (const [pid, p] of gameState.players) {
            if (p.alive) allDead = false
            if (p.progress >= GOAL && p.alive) {
                winner = pid
                break
            }
        }

        if (winner) {
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        } else if (allDead && players.length > 0) {
            // Everyone died? No winner? Or last to die?
            // Simplest: No winner.
            endGame(null)
        }

    }, [gameState.players, players.length, isPlaying, isLeader, winnerId, currentPlayerId, endGame])


    const handleChop = useCallback((side: Side) => {
        if (!isPlaying || !currentPlayerId) return

        // Optimistic check?
        // Need to check if branch kills me
        // Current Branch to check is at `progress + 1`?
        // Visually: Player is at bottom. Branches fall down.
        // `branches[0]` is the one right above head? 
        // No, `branches` is the static tree. `progress` is how many we chopped.
        // If I chop, I remove bottom branch?
        // Logically: `branches` is array of size 50.
        // `progress` = 0. Next branch is `branches[0]`.
        // If I move to Side X and Chop.
        // If `branches[0]` is on Side X, I die?
        // Usually Tree falls down. So if I am on Left, and branch is on Left, I die.
        // BUT, the branch that kills you is the one coming DOWN.
        // So at `progress=0`, I see `branches[0]` just above me?
        // Let's say: `branches[i]` is the branch at height `i`.
        // When I am at `progress=0`, I am safe. I chop.
        // Tree falls. `branches[0]` is now at my feet (gone).
        // `branches[1]` falls to my head level.
        // So I must NOT be on the side of `branches[1]`.
        // Wait, if I chop `branches[0]`, `branches[1]` falls.
        // So BEFORE I chop, I must ensure `branches[1]` is not on my side?
        // Actually, classic Timberman: You chop. If there is a branch on your side at the current level, you die.

        updateGameState(state => {
            const p = state.players.get(currentPlayerId)
            if (!p || !p.alive) return state
            const currentBranch = state.branches[p.progress]

            // Check death collision
            if (currentBranch === side) {
                // Die
                playFail()
                const nextPlayers = new Map(state.players)
                nextPlayers.set(currentPlayerId, { ...p, side, alive: false })
                return { ...state, players: nextPlayers }
            }

            // Chop success
            playTap()
            const nextPlayers = new Map(state.players)
            nextPlayers.set(currentPlayerId, { ...p, side, progress: p.progress + 1 })
            return { ...state, players: nextPlayers }
        })

    }, [isPlaying, currentPlayerId, updateGameState])

    const myState = gameState.players.get(currentPlayerId || '')
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
                    {/* Leaderboard small */}
                    {Array.from(gameState.players.values()).map((p, i) => {
                        // Find owner ID
                        const pid = [...gameState.players.entries()].find(([, v]) => v === p)?.[0]
                        const pName = players.find(pl => pl.id === pid)?.username
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
