/**
 * NumberCrunch - Solve math problems!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useState, useRef } from 'react'
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
        },
        gameReducer: (state, event) => {
            if (event.type === 'NEW_PROBLEM') {
                const { problem } = event as any
                return {
                    ...state,
                    currentProblem: problem
                }
            }
            if (event.type === 'SOLVE_PROBLEM') {
                // Wait, score is derived. 1 point per solve?
                // Or senderId gets +1?
                // "SOLVE_PROBLEM" implies sender solved it.
                // WE MUST CHECK IF PROBLEM IS STILL ACTIVE?
                // If multiple people solve same problem?
                // Usually "First" wins.
                // The reducer receives events in order.
                // We can add a "solved" flag to problem?
                // Or just process it.
                // If we want "First to solve gets unique point":

                // Let's assume we allow multiple solves per problem if they are close, OR
                // Check if problem ID matches?
                // Let's keep it simple: Scores increment. 

                const newScores = new Map(state.scores)
                newScores.set(event.senderId, (newScores.get(event.senderId) || 0) + 1)

                return { ...state, scores: newScores }
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
        dispatchGameEvent,
    } = engine

    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
    const [answered, setAnswered] = useState(false)
    const isLeader = players.length > 0 && players[0].id === currentPlayerId


    // Game Over on Timeout (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        if (isPlaying && timeRemaining !== null && timeRemaining <= 0 && !winnerId) {
            const sorted = [...gameState.scores.entries()].sort((a, b) => b[1] - a[1])
            const winner = sorted[0]?.[0] || null
            playWinFanfare()
            endGame(winner)
        }
    }, [timeRemaining, isPlaying, winnerId, gameState.scores, endGame, players, currentPlayerId])

    // Initialize/Regenerate Problems (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        // Start first problem
        if (isPlaying && isLeader && !gameState.currentProblem) {
            const p = generateProblem()
            dispatchGameEvent('NEW_PROBLEM', { problem: p })
        }
    }, [isPlaying, isLeader, gameState.currentProblem, dispatchGameEvent, players, currentPlayerId])


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
            dispatchGameEvent('SOLVE_PROBLEM', {})

            // If I solved it, I shouldn't generate new problem directly?
            // Host should see I solved it and generate new one?
            // OR I generate it if I am Host?
            // Better: 'SOLVE_PROBLEM' event triggers a check on Host.
        } else {
            playFail()
        }
    }, [isPlaying, currentPlayerId, gameState.currentProblem, answered, dispatchGameEvent])

    // Host watches for Solves to generate new problem
    // This is tricky. If multiple people solve, we might skip problems?
    // Let's rely on Score Changes?
    // If scores change, it means someone solved it.
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isPlaying || !isLeader) return

        // We need to know if the CURRENT problem was solved.
        // We can track total score?
        // Or better: The EVENT 'SOLVE_PROBLEM' could be accompanied by a 'NEW_PROBLEM' event from Host?
        // No, Host needs to react.

        // Let's use a ref to track total score?
        // Or simplier: If someone solves, we wait 500ms then New Problem.
        // But how do we know someone solved it recently?
        // We can check if 'answered' is true for us? No, that's local.

        // Alternative: The Client who answers correctly ALSO dispatches 'NEW_PROBLEM' if they are Host?
        // NO. Host Auth.

        // Solution: Host observes `gameState.scores`. If it changes, trigger new problem.
        // We need a ref to previous total score.
    }, [gameState.scores])

    // Actually, let's just make the Solved event trigger a new problem generation on Host side via `processEvent`?
    // `useMinigameEngine` doesn't expose `processEvent` hook easily for logic extension without forking.

    // Workaround: Host useEffect on scores.
    const prevTotalScore = useRef(0)
    useEffect(() => {
        const total = Array.from(gameState.scores.values()).reduce((a, b) => a + b, 0)
        if (total > prevTotalScore.current && isPlaying && isLeader) {
            // Score increased! Someone solved it.
            setTimeout(() => {
                const p = generateProblem()
                dispatchGameEvent('NEW_PROBLEM', { problem: p })
            }, 500)
        }
        prevTotalScore.current = total
    }, [gameState.scores, isPlaying, isLeader, dispatchGameEvent])

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
