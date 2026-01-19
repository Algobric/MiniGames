/**
 * NumberCrunch - Solve math problems!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

type Operation = '+' | '-' | '×'

interface MathProblem {
    a: number
    b: number
    op: Operation
    answer: number
    options: number[]
}

interface NumberCrunchState {
    currentProblem: MathProblem | null
    scores: Map<string, number>
}

const generateProblem = (): MathProblem => {
    const ops: Operation[] = ['+', '-', '×']
    const op = ops[Math.floor(Math.random() * ops.length)]
    let a: number, b: number, answer: number

    switch (op) {
        case '+':
            a = Math.floor(Math.random() * 50) + 1
            b = Math.floor(Math.random() * 50) + 1
            answer = a + b
            break
        case '-':
            a = Math.floor(Math.random() * 50) + 20
            b = Math.floor(Math.random() * a)
            answer = a - b
            break
        case '×':
            a = Math.floor(Math.random() * 12) + 1
            b = Math.floor(Math.random() * 12) + 1
            answer = a * b
            break
        default:
            a = 1; b = 1; answer = 2
    }

    const options = [answer]
    while (options.length < 4) {
        const wrong = answer + (Math.floor(Math.random() * 20) - 10)
        if (wrong !== answer && wrong > 0 && !options.includes(wrong)) {
            options.push(wrong)
        }
    }
    options.sort(() => Math.random() - 0.5)

    return { a, b, op, answer, options }
}

const NumberCrunch = () => {
    const engine = useMinigameEngine<NumberCrunchState>({
        config: {
            countdownDuration: 3,
            gameDuration: 30 // 30 seconds game
        },
        initialGameState: {
            currentProblem: null,
            scores: new Map()
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
        updateGameState,
        endGame
    } = engine

    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
    const [answered, setAnswered] = useState(false)
    const isLeader = players.length > 0 && players[0].id === currentPlayerId

    // Game Over on Timeout
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return

        if (timeRemaining !== null && timeRemaining <= 0) {
            const sorted = [...gameState.scores.entries()].sort((a, b) => b[1] - a[1])
            const winner = sorted[0]?.[0] || null
            playWinFanfare()
            endGame(winner)
        }
    }, [timeRemaining, isPlaying, isLeader, winnerId, gameState.scores, endGame])

    // Initialize scores and first problem
    useEffect(() => {
        if (isPlaying && isLeader && !gameState.currentProblem) {
            updateGameState(state => ({
                ...state,
                currentProblem: generateProblem(),
                scores: new Map(players.map(p => [p.id, 0]))
            }))
        }
    }, [isPlaying, isLeader, gameState.currentProblem, players, updateGameState])

    // Detect when problem changes to reset local state
    useEffect(() => {
        if (gameState.currentProblem) {
            setAnswered(false)
            setFeedback(null)
        }
    }, [gameState.currentProblem])

    const handleAnswer = useCallback((choice: number) => {
        if (!isPlaying || !currentPlayerId || !gameState.currentProblem || answered) return

        const isCorrect = choice === gameState.currentProblem.answer
        setAnswered(true)
        setFeedback(isCorrect ? 'correct' : 'wrong')

        if (isCorrect) {
            playTap()
            // Update score
            updateGameState(state => ({
                ...state,
                scores: new Map([...state.scores, [currentPlayerId, (state.scores.get(currentPlayerId) || 0) + 1]])
            }))

            // Only leader generates new problem if THEY answer correctly? 
            // Or anyone? 
            // Actually, if it's a shared problem, usually whoever answers first gets the point and problem changes.
            // BUT, usually in these games everyone solves the SAME problem LOCALLY or everyone races to solve ONE problem?
            // The original implementation had "Next problem... if (isHost) setTimeout(generate, 500)".
            // This implies a SHARED problem queue.
            // So if I answer correctly, the problem changes for EVERYONE.
            // This is "First to solve gets point".

            if (isLeader) {
                setTimeout(() => {
                    updateGameState(state => ({ ...state, currentProblem: generateProblem() }))
                }, 500)
            } else {
                // If I'm not leader, how do I trigger new problem? 
                // I don't. The leader should subscribe to score changes or answers?
                // Wait, `updateGameState` updates global state. 
                // But generating a new problem is logic.
                // Leader needs to observe that a correct answer happened.
                // Actually, simpler: whoever answers correctly (client side check) calls updateGameState with NEW problem!
                // Since `generateProblem` is deterministic enough or we don't care if it's Client valid.
                // Yes, client can generate new problem and push it to state.
                // Use `setTimeout` to avoid instant flicker.

                setTimeout(() => {
                    updateGameState(state => ({ ...state, currentProblem: generateProblem() }))
                }, 500)
            }
        } else {
            playFail()
        }
    }, [isPlaying, currentPlayerId, gameState.currentProblem, answered, updateGameState, isLeader])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-blue-800 to-indigo-950"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2" style={{ textShadow: '0 0 15px #00F' }}>
                        🔢 NUMBER CRUNCH!
                    </h1>
                </div>

                {isPlaying && gameState.currentProblem && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <motion.div
                            key={`${gameState.currentProblem.a}${gameState.currentProblem.op}${gameState.currentProblem.b}`}
                            initial={{ scale: 0, rotate: -10 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="text-5xl md:text-7xl font-pixel text-white mb-8"
                            style={{ textShadow: '0 4px 0 #000' }}
                        >
                            {gameState.currentProblem.a} {gameState.currentProblem.op} {gameState.currentProblem.b} = ?
                        </motion.div>

                        <div className="grid grid-cols-2 gap-4">
                            {gameState.currentProblem.options.map((option, i) => (
                                <motion.button
                                    key={i}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleAnswer(option)}
                                    disabled={answered}
                                    className={clsx(
                                        "w-24 h-16 md:w-32 md:h-20 rounded-xl text-2xl md:text-3xl font-pixel transition-all",
                                        answered && option === gameState.currentProblem?.answer && "bg-green-600 border-4 border-green-400",
                                        answered && option !== gameState.currentProblem?.answer && "bg-gray-700 opacity-50",
                                        !answered && "bg-indigo-600 hover:bg-indigo-500"
                                    )}
                                >
                                    {option}
                                </motion.button>
                            ))}
                        </div>

                        {feedback && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={clsx(
                                    "mt-4 text-2xl font-pixel",
                                    feedback === 'correct' ? "text-green-400" : "text-red-400"
                                )}
                            >
                                {feedback === 'correct' ? '✓ CORRECT!' : '✗ WRONG!'}
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Scores */}
                <div className="flex gap-4 pb-4">
                    {players.map(player => (
                        <div
                            key={player.id}
                            className={clsx(
                                "text-center px-4 py-2 rounded-lg",
                                player.id === currentPlayerId ? "bg-indigo-700 border border-indigo-400" : "bg-white/10"
                            )}
                        >
                            <div className="text-sm text-white/70">{player.username}</div>
                            <div className="text-2xl font-pixel text-cyan-400">{gameState.scores.get(player.id) || 0}</div>
                        </div>
                    ))}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default NumberCrunch
