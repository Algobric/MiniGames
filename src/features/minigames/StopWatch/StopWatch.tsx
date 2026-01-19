/**
 * StopWatch - Stop exactly at 10.00s!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare } from '../HighNoon/sounds'

const TARGET_TIME = 10000 // 10.00 seconds

interface StopWatchState {
    startTime: number
    stoppedTimes: Map<string, number>
}

const StopWatch = () => {
    const engine = useMinigameEngine<StopWatchState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            startTime: 0,
            stoppedTimes: new Map()
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

    const displayRef = useRef<number>(0)
    const hasStopped = currentPlayerId ? gameState.stoppedTimes.has(currentPlayerId) : false
    const gameEndedRef = useRef(false)

    // Start timer
    useEffect(() => {
        if (isPlaying && gameState.startTime === 0) {
            updateGameState(state => ({ ...state, startTime: Date.now() }))
        }
    }, [isPlaying, gameState.startTime, updateGameState])

    // Update display (visual only)
    useEffect(() => {
        if (!isPlaying || hasStopped || !gameState.startTime) return
        const interval = setInterval(() => {
            displayRef.current = Date.now() - gameState.startTime
        }, 10)
        return () => clearInterval(interval)
    }, [isPlaying, hasStopped, gameState.startTime])

    // Check for game over
    useEffect(() => {
        if (!isPlaying || winnerId || gameEndedRef.current) return

        if (gameState.stoppedTimes.size === players.length && players.length > 0) {
            gameEndedRef.current = true

            // Find winner
            let bestId = ''
            let closestDiff = Infinity

            gameState.stoppedTimes.forEach((time, pid) => {
                const diff = Math.abs(time - TARGET_TIME)
                if (diff < closestDiff) {
                    closestDiff = diff
                    bestId = pid
                }
            })

            const winner = bestId || null
            if (winner === currentPlayerId) playWinFanfare()

            const results = Array.from(gameState.stoppedTimes.entries()).map(([pid, time]) => ({
                playerId: pid,
                score: Math.abs(time - TARGET_TIME), // Lower is better
                rank: 0 // Will be sorted by score
            })).sort((a, b) => a.score - b.score).map((r, i) => ({ ...r, rank: i + 1 }))

            endGame(winner, results)
        }
    }, [gameState.stoppedTimes, players.length, isPlaying, winnerId, currentPlayerId, endGame])

    const handleStop = useCallback(() => {
        if (!isPlaying || !currentPlayerId || hasStopped || !gameState.startTime) return

        playTap()
        const stopTime = Date.now() - gameState.startTime
        updateGameState(state => ({
            ...state,
            stoppedTimes: new Map([...state.stoppedTimes, [currentPlayerId, stopTime]])
        }))
    }, [isPlaying, currentPlayerId, hasStopped, gameState.startTime, updateGameState])

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000)
        const cents = Math.floor((ms % 1000) / 10)
        return `${seconds.toString().padStart(2, '0')}.${cents.toString().padStart(2, '0')}`
    }

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-gray-800 to-black"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        ⏱️ STOPWATCH!
                    </h1>
                    <p className="text-lg text-cyan-400">Stop at exactly {formatTime(TARGET_TIME)}</p>
                </div>

                {/* Main Action Area */}
                <div className="flex-1 flex flex-col items-center justify-center">
                    {isPlaying && !hasStopped && (
                        <>
                            <div className="text-6xl font-pixel text-red-500 mb-4 animate-pulse">???</div>
                            <p className="text-white/70 mb-8">Timer is running...</p>
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={handleStop}
                                className="px-16 py-8 text-3xl font-pixel bg-red-600 text-white rounded-full shadow-lg"
                                style={{ boxShadow: '0 0 30px #FF0000' }}
                            >
                                ⏹️ STOP!
                            </motion.button>
                        </>
                    )}

                    {isPlaying && hasStopped && (
                        <div className="text-center">
                            <div className="text-4xl font-pixel text-green-400 mb-4">✓ STOPPED</div>
                            <p className="text-white/70">Waiting for other players...</p>
                        </div>
                    )}

                    {winnerId && (
                        <div className="w-full max-w-md mt-8">
                            {players.map(player => {
                                const time = gameState.stoppedTimes.get(player.id) || 0
                                const diff = Math.abs(time - TARGET_TIME)
                                const isWinner = player.id === winnerId

                                return (
                                    <motion.div
                                        key={player.id}
                                        initial={{ x: -50, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        className={clsx(
                                            "flex justify-between items-center px-4 py-2 rounded-lg mb-2",
                                            isWinner ? "bg-yellow-500/30 border-2 border-yellow-400" : "bg-white/10"
                                        )}
                                    >
                                        <span className="text-white">{player.username}</span>
                                        <span className={clsx("font-pixel", isWinner ? "text-yellow-400" : "text-white")}>
                                            {formatTime(time)} ({diff < 100 ? '+' : ''}{(diff / 1000).toFixed(2)}s)
                                        </span>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default StopWatch
