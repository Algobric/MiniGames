import { useEffect, useState, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'
type Operation = '+' | '-' | '×'

interface MathProblem {
    a: number
    b: number
    op: Operation
    answer: number
    options: number[]
}

const GAME_DURATION = 30000 // 30 seconds

const NumberCrunch: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
    const [problem, setProblem] = useState<MathProblem | null>(null)
    const [scores, setScores] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [winner, setWinner] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
    const [answered, setAnswered] = useState(false)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false

    // Unlock audio
    useEffect(() => {
        const handleInteraction = () => {
            unlockAudio()
            window.removeEventListener('pointerdown', handleInteraction)
        }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    // Generate a random problem
    const generateProblem = useCallback((): MathProblem => {
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

        // Generate wrong options
        const options = [answer]
        while (options.length < 4) {
            const wrong = answer + (Math.floor(Math.random() * 20) - 10)
            if (wrong !== answer && wrong > 0 && !options.includes(wrong)) {
                options.push(wrong)
            }
        }
        // Shuffle options
        options.sort(() => Math.random() - 0.5)

        return { a, b, op, answer, options }
    }, [])

    // Countdown
    useEffect(() => {
        if (phase !== 'COUNTDOWN') return
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    playCountdownBeep(true)
                    setPhase('PLAYING')
                    if (isHost) {
                        const newProblem = generateProblem()
                        broadcastAndApply({ type: 'MATH_PROBLEM', problem: newProblem })
                    }
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase, isHost, generateProblem, broadcastAndApply])

    // Game timer
    useEffect(() => {
        if (phase !== 'PLAYING') return
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 100) {
                    clearInterval(interval)
                    if (isHost) {
                        const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1])
                        const winnerId = sortedScores[0]?.[0]
                        broadcastAndApply({ type: 'MATH_GAME_OVER', winnerId })
                    }
                    return 0
                }
                return prev - 100
            })
        }, 100)
        return () => clearInterval(interval)
    }, [phase, isHost, scores, broadcastAndApply])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'MATH_PROBLEM') {
            setProblem(lastBroadcast.problem)
            setAnswered(false)
            setFeedback(null)
        }

        if (lastBroadcast.type === 'MATH_ANSWER') {
            if (lastBroadcast.correct) {
                setScores(prev => {
                    const next = new Map(prev)
                    next.set(lastBroadcast.playerId, (prev.get(lastBroadcast.playerId) || 0) + 1)
                    return next
                })

                // Next problem
                if (isHost) {
                    setTimeout(() => {
                        const newProblem = generateProblem()
                        broadcastAndApply({ type: 'MATH_PROBLEM', problem: newProblem })
                    }, 500)
                }
            }
        }

        if (lastBroadcast.type === 'MATH_GAME_OVER') {
            setPhase('ENDED')
            setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            else playFail()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, isHost, currentPlayer?.id, generateProblem, onGameEnd, broadcastAndApply])

    const handleAnswer = useCallback((choice: number) => {
        if (phase !== 'PLAYING' || !currentPlayer || !problem || answered) return

        const isCorrect = choice === problem.answer
        setAnswered(true)
        setFeedback(isCorrect ? 'correct' : 'wrong')

        if (isCorrect) playTap()
        else playFail()

        broadcastAndApply({
            type: 'MATH_ANSWER',
            playerId: currentPlayer.id,
            correct: isCorrect
        })
    }, [phase, currentPlayer, problem, answered, broadcastAndApply])

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-blue-800 to-indigo-950 select-none p-4">
            {/* Header */}
            <div className="text-center pt-2">
                <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2" style={{ textShadow: '0 0 15px #00F' }}>
                    🔢 NUMBER CRUNCH!
                </h1>
                {phase === 'PLAYING' && (
                    <div className="text-xl text-yellow-400">{(timeLeft / 1000).toFixed(1)}s</div>
                )}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">
                    {countdown}
                </motion.div>
            )}

            {/* Problem area */}
            {phase === 'PLAYING' && problem && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <motion.div
                        key={`${problem.a}${problem.op}${problem.b}`}
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="text-5xl md:text-7xl font-pixel text-white mb-8"
                        style={{ textShadow: '0 4px 0 #000' }}
                    >
                        {problem.a} {problem.op} {problem.b} = ?
                    </motion.div>

                    <div className="grid grid-cols-2 gap-4">
                        {problem.options.map((option, i) => (
                            <motion.button
                                key={i}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleAnswer(option)}
                                disabled={answered}
                                className={clsx(
                                    "w-24 h-16 md:w-32 md:h-20 rounded-xl text-2xl md:text-3xl font-pixel transition-all",
                                    answered && option === problem.answer && "bg-green-600 border-4 border-green-400",
                                    answered && option !== problem.answer && "bg-gray-700 opacity-50",
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
                            player.id === currentPlayer?.id ? "bg-indigo-700 border border-indigo-400" : "bg-white/10"
                        )}
                    >
                        <div className="text-sm text-white/70">{player.username}</div>
                        <div className="text-2xl font-pixel text-cyan-400">{scores.get(player.id) || 0}</div>
                    </div>
                ))}
            </div>

            {/* Winner */}
            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🧮</div>
                        <div className="text-4xl font-pixel text-cyan-400">
                            {players.find(p => p.id === winner)?.username} WINS!
                        </div>
                        <div className="text-xl text-white/70 mt-2">
                            {scores.get(winner)} problems solved
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default NumberCrunch
