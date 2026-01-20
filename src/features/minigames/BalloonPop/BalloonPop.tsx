/**
 * BalloonPop - Inflate without popping!
 * 5 ROUNDS - Random pop threshold each round
 * Spacebar to pump, time limit per round
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

const TOTAL_ROUNDS = 5
const ROUND_TIME = 8000 // 8 seconds per round
const PUMP_INCREMENT = 5

interface PlayerScore {
    playerId: string
    score: number
}

interface BalloonSize {
    playerId: string
    size: number
}

interface BalloonPopState {
    round: number
    roundPhase: 'PUMPING' | 'RESULT' | 'ENDED'
    popThreshold: number  // Random each round (60-95)
    balloonSizes: BalloonSize[]
    popped: string[]
    scores: PlayerScore[]
    roundStartTime: number
    roundWinner: string | null
}

// Helper functions
const getBalloonSize = (sizes: BalloonSize[], playerId: string) =>
    sizes.find(s => s.playerId === playerId)?.size || 0

const hasPopped = (popped: string[], playerId: string) =>
    popped.includes(playerId)

const getScore = (scores: PlayerScore[], playerId: string) =>
    scores.find(s => s.playerId === playerId)?.score || 0

const BalloonPop = () => {
    const engine = useMinigameEngine<BalloonPopState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            round: 0,
            roundPhase: 'PUMPING',
            popThreshold: 80,
            balloonSizes: [],
            popped: [],
            scores: [],
            roundStartTime: 0,
            roundWinner: null
        },
        gameReducer: (state, event) => {
            const balloonSizes = Array.isArray(state.balloonSizes) ? state.balloonSizes : []
            const popped = Array.isArray(state.popped) ? state.popped : []
            const scores = Array.isArray(state.scores) ? state.scores : []

            if (event.type === 'NEW_ROUND') {
                const { round, popThreshold, startTime } = event as any
                return {
                    ...state,
                    round,
                    roundPhase: 'PUMPING',
                    popThreshold,
                    balloonSizes: [],
                    popped: [],
                    roundStartTime: startTime,
                    roundWinner: null
                }
            }

            if (event.type === 'BALLOON_PUMP') {
                const { playerId, newSize, didPop } = event as any

                if (didPop) {
                    return { ...state, popped: [...popped, playerId] }
                }

                const existingIdx = balloonSizes.findIndex(s => s.playerId === playerId)
                let newSizes: BalloonSize[]
                if (existingIdx >= 0) {
                    newSizes = [...balloonSizes]
                    newSizes[existingIdx] = { playerId, size: newSize }
                } else {
                    newSizes = [...balloonSizes, { playerId, size: newSize }]
                }
                return { ...state, balloonSizes: newSizes }
            }

            if (event.type === 'ROUND_END') {
                const { winnerId } = event as any
                let newScores = [...scores]

                if (winnerId) {
                    const idx = newScores.findIndex(s => s.playerId === winnerId)
                    if (idx >= 0) {
                        newScores[idx] = { playerId: winnerId, score: newScores[idx].score + 1 }
                    } else {
                        newScores.push({ playerId: winnerId, score: 1 })
                    }
                }

                return { ...state, roundPhase: 'RESULT', roundWinner: winnerId, scores: newScores }
            }

            if (event.type === 'GAME_COMPLETE') {
                return { ...state, roundPhase: 'ENDED' }
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
        dispatchGameEvent,
        updateGameState,
        endGame
    } = engine

    // Safe access
    const balloonSizes = Array.isArray(gameState.balloonSizes) ? gameState.balloonSizes : []
    const popped = Array.isArray(gameState.popped) ? gameState.popped : []
    const scores = Array.isArray(gameState.scores) ? gameState.scores : []

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const roundRef = useRef(0)
    const roundEndedRef = useRef(false)
    const gameEndedRef = useRef(false)

    // Keep roundRef in sync
    useEffect(() => {
        roundRef.current = gameState.round
        roundEndedRef.current = false
    }, [gameState.round])

    // Initialize scores
    useEffect(() => {
        if (players.length > 0 && scores.length === 0 && isPlaying) {
            updateGameState(state => ({
                ...state,
                scores: players.map(p => ({ playerId: p.id, score: 0 }))
            }))
        }
    }, [players, scores.length, isPlaying, updateGameState])

    // Start first round (Leader)
    useEffect(() => {
        if (isPlaying && gameState.round === 0 && isLeader) {
            startNewRound()
        }
    }, [isPlaying, gameState.round, isLeader])

    const startNewRound = useCallback(() => {
        const currentRound = roundRef.current
        const newRound = currentRound + 1

        if (newRound > TOTAL_ROUNDS) {
            if (!gameEndedRef.current) {
                gameEndedRef.current = true
                // Determine overall winner
                const sortedScores = [...scores].sort((a, b) => b.score - a.score)
                const topWinner = sortedScores[0]?.playerId || null
                playWinFanfare()
                dispatchGameEvent('GAME_COMPLETE', {})
                setTimeout(() => endGame(topWinner), 1000)
            }
            return
        }

        // Random pop threshold between 60-95
        const popThreshold = 60 + Math.floor(Math.random() * 36)

        console.log(`[BalloonPop] Starting round ${newRound}, pop threshold: ${popThreshold}`)
        dispatchGameEvent('NEW_ROUND', {
            round: newRound,
            popThreshold,
            startTime: Date.now()
        })
    }, [scores, dispatchGameEvent, endGame])

    // Round timer - check if time is up
    useEffect(() => {
        if (!isPlaying || !isLeader || gameState.roundPhase !== 'PUMPING' || winnerId) return

        const checkRoundEnd = () => {
            const elapsed = Date.now() - gameState.roundStartTime
            if (elapsed >= ROUND_TIME && !roundEndedRef.current) {
                roundEndedRef.current = true
                endCurrentRound()
            }
        }

        const interval = setInterval(checkRoundEnd, 100)
        return () => clearInterval(interval)
    }, [isPlaying, isLeader, gameState.roundPhase, gameState.roundStartTime, winnerId])

    // Calculate round time remaining
    const roundTimeRemaining = gameState.roundPhase === 'PUMPING'
        ? Math.max(0, ROUND_TIME - (Date.now() - gameState.roundStartTime))
        : 0

    const endCurrentRound = useCallback(() => {
        // Find winner: highest size that didn't pop
        const activePlayers = players.filter(p => !hasPopped(popped, p.id))

        if (activePlayers.length === 0) {
            // Everyone popped - no winner
            dispatchGameEvent('ROUND_END', { winnerId: null })
        } else {
            // Find highest
            let maxSize = -1
            let candidates: string[] = []

            for (const p of activePlayers) {
                const size = getBalloonSize(balloonSizes, p.id)
                if (size > maxSize) {
                    maxSize = size
                    candidates = [p.id]
                } else if (size === maxSize) {
                    candidates.push(p.id)
                }
            }

            // If tie, pick randomly
            const winnerId = candidates.length === 1
                ? candidates[0]
                : candidates[Math.floor(Math.random() * candidates.length)]

            if (winnerId === currentPlayerId) playWinFanfare()
            dispatchGameEvent('ROUND_END', { winnerId })
        }
    }, [players, popped, balloonSizes, currentPlayerId, dispatchGameEvent])

    // Auto-advance to next round after result
    useEffect(() => {
        if (!isLeader || gameState.roundPhase !== 'RESULT') return

        const timer = setTimeout(() => {
            startNewRound()
        }, 2500)

        return () => clearTimeout(timer)
    }, [gameState.roundPhase, isLeader, startNewRound])

    // Spacebar to pump
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault()
                handlePump()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handlePump = useCallback(() => {
        if (!isPlaying || !currentPlayerId || gameState.roundPhase !== 'PUMPING') return
        if (hasPopped(popped, currentPlayerId)) return

        const currentSize = getBalloonSize(balloonSizes, currentPlayerId)
        const newSize = currentSize + PUMP_INCREMENT
        playTap()

        // Check if exceeded pop threshold
        const didPop = newSize >= gameState.popThreshold

        if (didPop) {
            playFail()
        }

        dispatchGameEvent('BALLOON_PUMP', { playerId: currentPlayerId, newSize, didPop })
    }, [isPlaying, currentPlayerId, gameState.roundPhase, gameState.popThreshold, popped, balloonSizes, dispatchGameEvent])

    const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#DDA0DD', '#87CEEB']

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-sky-300 to-sky-500"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🎈 BALLOON POP!
                    </h1>
                    {isPlaying && (
                        <div className="flex gap-4 justify-center mt-2">
                            <div className="text-lg text-white/80">
                                Round {gameState.round}/{TOTAL_ROUNDS}
                            </div>
                            {gameState.roundPhase === 'PUMPING' && (
                                <div className="text-lg text-yellow-300 font-pixel">
                                    ⏱️ {(roundTimeRemaining / 1000).toFixed(1)}s
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Scores */}
                {isPlaying && (
                    <div className="flex gap-4 justify-center">
                        {players.map(p => (
                            <div key={p.id} className={clsx(
                                "text-center px-3 py-1 rounded-lg",
                                p.id === currentPlayerId ? "bg-yellow-400/30" : "bg-white/20"
                            )}>
                                <div className="text-xs text-white/70">{p.username}</div>
                                <div className="text-xl font-pixel text-white">{getScore(scores, p.id)} pts</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex-1 flex items-center justify-center gap-8 flex-wrap content-center">
                    {players.map((player, idx) => {
                        const size = getBalloonSize(balloonSizes, player.id)
                        const playerPopped = hasPopped(popped, player.id)
                        const isRoundWinner = player.id === gameState.roundWinner

                        return (
                            <div key={player.id} className="text-center">
                                <div className="text-sm text-white mb-2">{player.username}</div>
                                <motion.div
                                    animate={{
                                        scale: playerPopped ? 0 : 1,
                                        opacity: playerPopped ? 0 : 1
                                    }}
                                    className="relative flex items-center justify-center"
                                    style={{ width: 150, height: 180 }}
                                >
                                    {!playerPopped && (
                                        <>
                                            <motion.div
                                                animate={{ scale: isRoundWinner ? [1, 1.1, 1] : 1 }}
                                                transition={{ repeat: isRoundWinner ? Infinity : 0, duration: 0.5 }}
                                                className={clsx("rounded-full mx-auto transition-all duration-100")}
                                                style={{
                                                    width: Math.max(30, size * 1.5),
                                                    height: Math.max(36, size * 1.8),
                                                    background: `radial-gradient(circle at 30% 30%, ${COLORS[idx % COLORS.length]}, ${COLORS[idx % COLORS.length]}88)`,
                                                }}
                                            />
                                            <div className="absolute top-[85%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-gray-600" />
                                        </>
                                    )}
                                    {playerPopped && <div className="text-4xl">💥</div>}
                                    {isRoundWinner && <div className="absolute -top-8 text-2xl">🏆</div>}
                                </motion.div>
                                <div className="text-lg text-white font-pixel mt-2">
                                    {playerPopped ? '💥 POP!' : `${Math.round(size)}%`}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {gameState.roundPhase === 'RESULT' && gameState.roundWinner && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-2xl text-center text-white font-pixel bg-green-500/80 px-6 py-3 rounded-xl"
                    >
                        {players.find(p => p.id === gameState.roundWinner)?.username} wins the round! 🎉
                    </motion.div>
                )}

                {gameState.roundPhase === 'RESULT' && !gameState.roundWinner && (
                    <div className="text-xl text-center text-white/70">Everyone popped! No winner...</div>
                )}

                {isPlaying && gameState.roundPhase === 'PUMPING' && !hasPopped(popped, currentPlayerId || '') && (
                    <div className="pb-4 text-center">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handlePump}
                            className="px-12 py-6 text-2xl font-pixel bg-red-500 text-white rounded-xl shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
                        >
                            💨 PUMP (SPACE)
                        </motion.button>
                        <div className="text-white/60 text-sm mt-2">Press SPACEBAR or tap to inflate!</div>
                    </div>
                )}

                {hasPopped(popped, currentPlayerId || '') && gameState.roundPhase === 'PUMPING' && (
                    <div className="pb-4 text-center text-xl text-red-400 font-pixel">
                        Your balloon popped! Wait for next round...
                    </div>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default BalloonPop
