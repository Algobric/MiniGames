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

interface TugOfWarState {
    ropePosition: number
    pullCounts: Map<string, number>
}

const TugOfWar = () => {
    const engine = useMinigameEngine<TugOfWarState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            ropePosition: 0,
            pullCounts: new Map()
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

    const gameEndedRef = useRef(false)
    const myIndex = players.findIndex(p => p.id === currentPlayerId)
    const myDirection = myIndex === 0 ? -1 : 1

    // Initialize pull counts
    useEffect(() => {
        if (players.length > 0 && gameState.pullCounts.size === 0) {
            updateGameState(state => ({
                ...state,
                pullCounts: new Map(players.map(p => [p.id, 0]))
            }))
        }
    }, [players, gameState.pullCounts.size, updateGameState])

    // Natural drift back to center
    useEffect(() => {
        if (!isPlaying || winnerId) return
        const interval = setInterval(() => {
            updateGameState(state => ({
                ...state,
                ropePosition: state.ropePosition * 0.99
            }))
        }, 50)
        return () => clearInterval(interval)
    }, [isPlaying, winnerId, updateGameState])

    // Check win condition
    useEffect(() => {
        if (!isPlaying || winnerId || gameEndedRef.current) return

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
        updateGameState(state => ({
            ...state,
            ropePosition: Math.max(-WIN_THRESHOLD, Math.min(WIN_THRESHOLD, state.ropePosition + myDirection * 3)),
            pullCounts: new Map([...state.pullCounts, [currentPlayerId, (state.pullCounts.get(currentPlayerId) || 0) + 1]])
        }))
    }, [isPlaying, currentPlayerId, winnerId, myDirection, updateGameState])

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
                                <div className="text-xs text-white/70">{gameState.pullCounts.get(players[0]?.id) || 0} pulls</div>
                            </div>
                            <div className={clsx("text-center", myIndex === 1 && "text-yellow-400")}>
                                <div className="text-2xl">💪</div>
                                <div className="text-sm text-white">{players[1]?.username}</div>
                                <div className="text-xs text-white/70">{gameState.pullCounts.get(players[1]?.id) || 0} pulls</div>
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
