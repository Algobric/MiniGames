/**
 * TugOfWar - Pull the rope!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

const WIN_THRESHOLD = 100
const PULL_FORCE = 10  // Increased from 3 to 10 for faster rounds

interface PullCount {
    playerId: string
    count: number
}

interface TugOfWarState {
    ropePosition: number
    pullCounts: PullCount[]  // Changed from Map to array
}

// Helper function
const getPullCount = (pullCounts: PullCount[], playerId: string) =>
    pullCounts.find(p => p.playerId === playerId)?.count || 0

const TugOfWar = () => {
    const engine = useMinigameEngine<TugOfWarState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            ropePosition: 0,
            pullCounts: []
        },
        gameReducer: (state, event) => {
            // Ensure pullCounts is array
            const pullCounts = Array.isArray(state.pullCounts) ? state.pullCounts : []

            if (event.type === 'TUG_PULL') {
                const { direction, playerId } = event as any
                const force = direction * PULL_FORCE
                const newPosition = Math.max(-WIN_THRESHOLD, Math.min(WIN_THRESHOLD, state.ropePosition + force))

                // Update pull counts
                const existingIdx = pullCounts.findIndex(p => p.playerId === playerId)
                let newCounts: PullCount[]
                if (existingIdx >= 0) {
                    newCounts = [...pullCounts]
                    newCounts[existingIdx] = { playerId, count: pullCounts[existingIdx].count + 1 }
                } else {
                    newCounts = [...pullCounts, { playerId, count: 1 }]
                }

                return { ...state, ropePosition: newPosition, pullCounts: newCounts }
            }

            if (event.type === 'TUG_DECAY') {
                return { ...state, ropePosition: state.ropePosition * 0.98 }
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
        dispatchGameEvent,
        updateGameState
    } = engine

    // Safe access to pullCounts
    const pullCounts = Array.isArray(gameState.pullCounts) ? gameState.pullCounts : []

    const gameEndedRef = useRef(false)
    const myIndex = players.findIndex(p => p.id === currentPlayerId)
    const myDirection = myIndex === 0 ? -1 : 1

    // Initialize pull counts
    useEffect(() => {
        if (players.length > 0 && pullCounts.length === 0 && isPlaying) {
            updateGameState(state => ({
                ...state,
                pullCounts: players.map(p => ({ playerId: p.id, count: 0 }))
            }))
        }
    }, [players, pullCounts.length, isPlaying, updateGameState])

    // Natural drift back to center (host only for consistency)
    useEffect(() => {
        if (!isPlaying || winnerId) return
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        const interval = setInterval(() => {
            dispatchGameEvent('TUG_DECAY', {})
        }, 100)
        return () => clearInterval(interval)
    }, [isPlaying, winnerId, players, currentPlayerId, dispatchGameEvent])

    // Check win condition
    useEffect(() => {
        if (!isPlaying || winnerId || gameEndedRef.current) return
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        if (Math.abs(gameState.ropePosition) >= WIN_THRESHOLD) {
            gameEndedRef.current = true
            const winnerIdx = gameState.ropePosition < 0 ? 0 : 1
            const winner = players[winnerIdx]?.id || null

            if (winner === currentPlayerId) playWinFanfare()
            else playFail()

            endGame(winner)
        }
    }, [gameState.ropePosition, isPlaying, winnerId, players, currentPlayerId, endGame])

    const handlePull = useCallback(() => {
        if (!isPlaying || !currentPlayerId || winnerId) return

        playTap()
        dispatchGameEvent('TUG_PULL', { direction: myDirection, playerId: currentPlayerId })
    }, [isPlaying, currentPlayerId, winnerId, myDirection, dispatchGameEvent])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-green-700 to-green-900"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🪢 TUG OF WAR!
                    </h1>
                </div>

                {isPlaying && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <div className="flex justify-between w-full max-w-md px-4 mb-4">
                            <div className={clsx("text-center", myIndex === 0 && "text-yellow-400")}>
                                <div className="text-2xl">💪</div>
                                <div className="text-sm text-white">{players[0]?.username}</div>
                                <div className="text-xs text-white/70">{getPullCount(pullCounts, players[0]?.id)} pulls</div>
                            </div>
                            <div className={clsx("text-center", myIndex === 1 && "text-yellow-400")}>
                                <div className="text-2xl">💪</div>
                                <div className="text-sm text-white">{players[1]?.username}</div>
                                <div className="text-xs text-white/70">{getPullCount(pullCounts, players[1]?.id)} pulls</div>
                            </div>
                        </div>

                        <div className="relative w-full max-w-md h-16 bg-amber-800 rounded-lg border-4 border-amber-900 overflow-hidden">
                            <div className="absolute top-0 left-1/2 w-1 h-full bg-white/50 -translate-x-1/2" />
                            <div className="absolute top-0 left-0 w-4 h-full bg-red-500/50" />
                            <div className="absolute top-0 right-0 w-4 h-full bg-blue-500/50" />

                            <motion.div
                                animate={{ x: gameState.ropePosition * 2 }}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                            >
                                <div className="w-8 h-8 bg-yellow-600 rounded-full border-4 border-yellow-400 shadow-lg" />
                                <div className="absolute top-1/2 -left-32 w-32 h-3 bg-amber-600 rounded-l-full -translate-y-1/2" />
                                <div className="absolute top-1/2 left-full w-32 h-3 bg-amber-600 rounded-r-full -translate-y-1/2" />
                            </motion.div>
                        </div>

                        <div className="mt-4 text-white text-lg">
                            {myIndex === 0 ? '⬅️ PULL LEFT' : '➡️ PULL RIGHT'}
                        </div>
                    </div>
                )}

                {isPlaying && (
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handlePull}
                        className="px-12 py-6 text-2xl font-pixel bg-yellow-500 text-black rounded-xl shadow-lg mb-4"
                    >
                        💪 PULL!
                    </motion.button>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default TugOfWar

