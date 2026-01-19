/**
 * InverseArrows - Press the OPPOSITE direction!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playFail } from '../HighNoon/sounds'

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
const TOTAL_ROUNDS = 10
const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']

interface InverseArrowsState {
    round: number
    currentDirection: Direction
    scores: Map<string, number>
}

const InverseArrows = () => {
    const engine = useMinigameEngine<InverseArrowsState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            round: 0,
            currentDirection: 'UP',
            scores: new Map()
        },
        gameReducer: (state, event) => {
            if (event.type === 'NEW_ROUND') {
                const { round, direction } = event as any
                return {
                    ...state,
                    round,
                    currentDirection: direction
                }
            }
            if (event.type === 'SUBMIT_ANSWER') {
                const { isCorrect } = event as any
                if (isCorrect) {
                    const newScores = new Map(state.scores)
                    newScores.set(event.senderId, (newScores.get(event.senderId) || 0) + 1)
                    return { ...state, scores: newScores }
                }
                return state
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
        dispatchGameEvent
    } = engine

    const [answered, setAnswered] = useState(false)
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const OPPOSITE: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
    const ARROWS: Record<Direction, string> = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' }

    // Helper to start next round (Host Only)
    const nextRound = useCallback(() => {
        const nextR = gameState.round + 1
        if (nextR > TOTAL_ROUNDS) {
            // Game Over
            dispatchGameEvent('SYSTEM_GAME_END_CHECK', {})
            return
        }

        const nextDir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]
        dispatchGameEvent('NEW_ROUND', { round: nextR, direction: nextDir })

    }, [gameState.round, dispatchGameEvent])

    // Initial Start (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (isPlaying && isLeader && gameState.round === 0) {
            nextRound()
        }
    }, [isPlaying, isLeader, gameState.round, nextRound, players, currentPlayerId])

    // Reset local state on round change
    useEffect(() => {
        setAnswered(false)
        setFeedback(null)
    }, [gameState.round])

    // Auto-advance round logic (Host Timer)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isPlaying || !isLeader || winnerId) return

        // We can use a simple timer for each round (e.g. 2 seconds)
        if (roundTimerRef.current) clearTimeout(roundTimerRef.current)

        // Start timer only if round > 0 (game running)
        if (gameState.round > 0) {
            roundTimerRef.current = setTimeout(() => {
                nextRound()
            }, 2500) // 2.5 seconds per round
        }

        return () => { if (roundTimerRef.current) clearTimeout(roundTimerRef.current) }
    }, [gameState.round, isPlaying, isLeader, winnerId, nextRound, players, currentPlayerId])

    // Game End Check (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        if (gameState.round > TOTAL_ROUNDS) {
            const sorted = [...gameState.scores.entries()].sort((a, b) => b[1] - a[1])
            const winner = sorted[0]?.[0] || null
            endGame(winner)
        }
    }, [gameState.round, gameState.scores, endGame, players, currentPlayerId])


    const handleAnswer = useCallback((dir: Direction) => {
        if (!isPlaying || !currentPlayerId || answered) return

        const correctAnswer = OPPOSITE[gameState.currentDirection]
        const isCorrect = dir === correctAnswer

        setAnswered(true)
        setFeedback(isCorrect ? 'correct' : 'wrong')

        if (isCorrect) playTap()
        else playFail()

        // Sync Score if correct
        if (isCorrect) {
            dispatchGameEvent('SUBMIT_ANSWER', { isCorrect: true })
        }

    }, [isPlaying, currentPlayerId, answered, gameState.currentDirection, dispatchGameEvent, OPPOSITE])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-rose-800 to-rose-950"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🔄 INVERSE ARROWS!
                    </h1>
                    <p className="text-lg text-pink-300">Tap the OPPOSITE!</p>
                    {isPlaying && <div className="text-sm text-white/50">Round {gameState.round} / {TOTAL_ROUNDS}</div>}
                </div>

                {isPlaying && gameState.round > 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <motion.div
                            key={gameState.round}
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="text-9xl mb-12"
                        >
                            {ARROWS[gameState.currentDirection]}
                        </motion.div>

                        {/* Controls */}
                        <div className="grid grid-cols-3 gap-4">
                            <div />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAnswer('UP')} disabled={answered}
                                className={clsx("w-20 h-20 bg-rose-600 rounded-xl text-4xl shadow-lg border-b-4 border-rose-800", answered && "opacity-50")}>⬆️</motion.button>
                            <div />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAnswer('LEFT')} disabled={answered}
                                className={clsx("w-20 h-20 bg-rose-600 rounded-xl text-4xl shadow-lg border-b-4 border-rose-800", answered && "opacity-50")}>⬅️</motion.button>
                            <div />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAnswer('RIGHT')} disabled={answered}
                                className={clsx("w-20 h-20 bg-rose-600 rounded-xl text-4xl shadow-lg border-b-4 border-rose-800", answered && "opacity-50")}>➡️</motion.button>
                            <div />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAnswer('DOWN')} disabled={answered}
                                className={clsx("w-20 h-20 bg-rose-600 rounded-xl text-4xl shadow-lg border-b-4 border-rose-800", answered && "opacity-50")}>⬇️</motion.button>
                            <div />
                        </div>

                        {feedback && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={clsx("absolute top-1/2 text-4xl font-bold bg-black/50 px-4 py-2 rounded", feedback === 'correct' ? "text-green-400" : "text-red-400")}
                            >
                                {feedback === 'correct' ? '✓' : '✗'}
                            </motion.div>
                        )}
                    </div>
                )}

                <div className="flex gap-4 pb-4">
                    {players.map(player => (
                        <div key={player.id} className={clsx("text-center px-4 py-2 rounded-lg", player.id === currentPlayerId ? "bg-rose-700" : "bg-white/10")}>
                            <div className="text-sm text-white/70">{player.username}</div>
                            <div className="text-2xl font-pixel text-pink-400">{gameState.scores.get(player.id) || 0}</div>
                        </div>
                    ))}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default InverseArrows
