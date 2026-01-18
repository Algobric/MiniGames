import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

const TOTAL_ROUNDS = 10

const InverseArrows: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [round, setRound] = useState(0)
    const [currentDirection, setCurrentDirection] = useState<Direction>('UP')
    const [scores, setScores] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [answered, setAnswered] = useState<Set<string>>(new Set())
    const [winner, setWinner] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
    const [roundTimeout, setRoundTimeout] = useState(false)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    const OPPOSITE: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
    const ARROWS: Record<Direction, string> = { UP: '⬆️', DOWN: '⬇️', LEFT: '⬅️', RIGHT: '➡️' }

    useEffect(() => {
        const handleInteraction = () => { unlockAudio(); window.removeEventListener('pointerdown', handleInteraction) }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    useEffect(() => {
        if (phase !== 'COUNTDOWN') return
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(interval); playCountdownBeep(true); if (isHost) startRound(); return 0 }
                playCountdownBeep(false); return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase, isHost])

    const startRound = useCallback(() => {
        const newRound = round + 1
        if (newRound > TOTAL_ROUNDS) {
            const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1])
            broadcastAndApply({ type: 'INVERSE_GAME_OVER', winnerId: sortedScores[0]?.[0] })
            return
        }

        const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]
        broadcastAndApply({ type: 'INVERSE_NEW_ROUND', round: newRound, direction: dir })
    }, [round, scores, broadcastAndApply])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'INVERSE_NEW_ROUND') {
            setRound(lastBroadcast.round)
            setCurrentDirection(lastBroadcast.direction)
            setAnswered(new Set())
            setFeedback(null)
            setRoundTimeout(false)
            setPhase('PLAYING')

            // Round timeout
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                setRoundTimeout(true)
                if (isHost) setTimeout(() => startRound(), 1000)
            }, 2000)
        }

        if (lastBroadcast.type === 'INVERSE_ANSWER') {
            setAnswered(prev => new Set(prev).add(lastBroadcast.playerId))

            if (lastBroadcast.correct) {
                setScores(prev => {
                    const next = new Map(prev)
                    next.set(lastBroadcast.playerId, (prev.get(lastBroadcast.playerId) || 0) + 1)
                    return next
                })
            }
        }

        if (lastBroadcast.type === 'INVERSE_GAME_OVER') {
            if (timerRef.current) clearTimeout(timerRef.current)
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, startRound, onGameEnd])

    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [])

    const handleAnswer = useCallback((dir: Direction) => {
        if (phase !== 'PLAYING' || !currentPlayer || answered.has(currentPlayer.id) || roundTimeout) return

        const correctAnswer = OPPOSITE[currentDirection]
        const isCorrect = dir === correctAnswer

        if (isCorrect) playTap()
        else playFail()

        setFeedback(isCorrect ? 'correct' : 'wrong')

        broadcastAndApply({
            type: 'INVERSE_ANSWER',
            playerId: currentPlayer.id,
            correct: isCorrect
        })

        if (isHost && !roundTimeout) {
            if (timerRef.current) clearTimeout(timerRef.current)
            setTimeout(() => startRound(), 1000)
        }
    }, [phase, currentPlayer, answered, roundTimeout, currentDirection, isHost, startRound, broadcastAndApply])

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-rose-800 to-rose-950 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🔄 FLECHAS INVERSAS!</h1>
                <p className="text-lg text-pink-300">¡Presiona la dirección OPUESTA!</p>
                {phase === 'PLAYING' && <div className="text-sm text-white/70">Ronda {round} / {TOTAL_ROUNDS}</div>}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase === 'PLAYING' && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    {/* Current arrow to invert */}
                    <motion.div
                        key={round}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="text-8xl mb-8"
                    >
                        {ARROWS[currentDirection]}
                    </motion.div>

                    {/* Feedback */}
                    {feedback && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={clsx("text-3xl mb-4", feedback === 'correct' ? "text-green-400" : "text-red-400")}
                        >
                            {feedback === 'correct' ? '✓ CORRECTO!' : '✗ INCORRECTO!'}
                        </motion.div>
                    )}

                    {/* Answer buttons */}
                    {!answered.has(currentPlayer?.id || '') && !roundTimeout && (
                        <div className="grid grid-cols-3 gap-2">
                            <div />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAnswer('UP')}
                                className="w-16 h-16 bg-rose-600 rounded-xl text-3xl">⬆️</motion.button>
                            <div />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAnswer('LEFT')}
                                className="w-16 h-16 bg-rose-600 rounded-xl text-3xl">⬅️</motion.button>
                            <div />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAnswer('RIGHT')}
                                className="w-16 h-16 bg-rose-600 rounded-xl text-3xl">➡️</motion.button>
                            <div />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAnswer('DOWN')}
                                className="w-16 h-16 bg-rose-600 rounded-xl text-3xl">⬇️</motion.button>
                        </div>
                    )}
                </div>
            )}

            {/* Scores */}
            <div className="flex gap-4 pb-4">
                {players.map(player => (
                    <div key={player.id} className={clsx("text-center px-4 py-2 rounded-lg", player.id === currentPlayer?.id ? "bg-rose-700" : "bg-white/10")}>
                        <div className="text-sm text-white/70">{player.username}</div>
                        <div className="text-2xl font-pixel text-pink-400">{scores.get(player.id) || 0}</div>
                    </div>
                ))}
            </div>

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🔄</div>
                        <div className="text-4xl font-pixel text-pink-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default InverseArrows
