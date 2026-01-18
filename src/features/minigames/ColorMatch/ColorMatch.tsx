import { useEffect, useState, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { useFairTiming } from '../../../hooks/useFairTiming'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

interface ColorConfig {
    name: string
    displayName: string
    bgColor: string
    textColor: string
}

const COLORS: ColorConfig[] = [
    { name: 'red', displayName: 'RED', bgColor: 'bg-red-600', textColor: 'text-red-600' },
    { name: 'blue', displayName: 'BLUE', bgColor: 'bg-blue-600', textColor: 'text-blue-600' },
    { name: 'green', displayName: 'GREEN', bgColor: 'bg-green-600', textColor: 'text-green-600' },
    { name: 'yellow', displayName: 'YELLOW', bgColor: 'bg-yellow-500', textColor: 'text-yellow-500' },
]

const TOTAL_ROUNDS = 5

const ColorMatch: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()
    const { getServerTimestamp } = useFairTiming()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [round, setRound] = useState(0)
    const [targetColor, setTargetColor] = useState<ColorConfig | null>(null)
    const [displayColor, setDisplayColor] = useState<ColorConfig | null>(null) // For the Stroop effect!
    const [scores, setScores] = useState<Map<string, number>>(
        new Map(players.map(p => [p.id, 0]))
    )
    const [roundWinner, setRoundWinner] = useState<string | null>(null)
    const [winner, setWinner] = useState<string | null>(null)
    const [hasAnswered, setHasAnswered] = useState(false)
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)

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

    // Countdown
    useEffect(() => {
        if (phase !== 'COUNTDOWN') return

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [phase])

    // Start game after countdown
    useEffect(() => {
        if (countdown === 0 && phase === 'COUNTDOWN') {
            playCountdownBeep(true)
            setPhase('PLAYING')

            if (isHost) {
                startNewRound()
            }
        }
    }, [countdown, phase, isHost])

    const startNewRound = useCallback(() => {
        const newRound = round + 1
        if (newRound > TOTAL_ROUNDS) {
            // Game over - determine final winner
            const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1])
            const winnerId = sortedScores[0]?.[0]

            broadcastAndApply({
                type: 'COLOR_GAME_OVER',
                winnerId,
                finalScores: Object.fromEntries(scores)
            })
            return
        }

        // Pick random target and display color (different for Stroop effect)
        const target = COLORS[Math.floor(Math.random() * COLORS.length)]
        const display = COLORS[Math.floor(Math.random() * COLORS.length)]

        broadcastAndApply({
            type: 'COLOR_NEW_ROUND',
            round: newRound,
            targetColorName: target.name,
            displayColorName: display.name,
            timestamp: Date.now()
        })
    }, [round, scores, broadcastAndApply])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'COLOR_NEW_ROUND') {
            setRound(lastBroadcast.round)
            setTargetColor(COLORS.find(c => c.name === lastBroadcast.targetColorName) || null)
            setDisplayColor(COLORS.find(c => c.name === lastBroadcast.displayColorName) || null)
            setRoundWinner(null)
            setHasAnswered(false)
            setFeedback(null)
        }

        if (lastBroadcast.type === 'COLOR_ANSWER') {
            if (lastBroadcast.correct && !roundWinner) {
                setRoundWinner(lastBroadcast.playerId)
                setScores(prev => {
                    const next = new Map(prev)
                    next.set(lastBroadcast.playerId, (prev.get(lastBroadcast.playerId) || 0) + 1)
                    return next
                })

                // Start next round after delay
                if (isHost) {
                    setTimeout(() => {
                        startNewRound()
                    }, 1500)
                }
            }
        }

        if (lastBroadcast.type === 'COLOR_GAME_OVER') {
            setWinner(lastBroadcast.winnerId)
            setPhase('ENDED')

            if (lastBroadcast.winnerId === currentPlayer?.id) {
                playWinFanfare()
            }

            if (isHost) {
                setTimeout(() => {
                    onGameEnd({ winnerId: lastBroadcast.winnerId })
                }, 3000)
            }
        }
    }, [lastBroadcast, roundWinner, isHost, currentPlayer?.id, startNewRound, onGameEnd])

    // Handle color button click
    const handleColorClick = useCallback((color: ColorConfig) => {
        if (!currentPlayer || phase !== 'PLAYING' || !targetColor || hasAnswered || roundWinner) return

        setHasAnswered(true)
        const isCorrect = color.name === targetColor.name
        const timestamp = getServerTimestamp()

        if (isCorrect) {
            setFeedback('correct')
            playTap()
        } else {
            setFeedback('wrong')
            playFail()
        }

        broadcastAndApply({
            type: 'COLOR_ANSWER',
            playerId: currentPlayer.id,
            colorName: color.name,
            correct: isCorrect,
            timestamp
        })
    }, [currentPlayer, phase, targetColor, hasAnswered, roundWinner, getServerTimestamp, broadcastAndApply])



    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-gray-900 to-black select-none p-4">
            {/* Header */}
            <div className="text-center pt-4">
                <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2"
                    style={{ textShadow: '0 0 15px #00FFFF' }}>
                    COLOR MATCH!
                </h1>

                {phase === 'PLAYING' && (
                    <div className="text-lg text-white/70">
                        Round {round} / {TOTAL_ROUNDS}
                    </div>
                )}

                {phase === 'COUNTDOWN' && (
                    <motion.div
                        key={countdown}
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-7xl md:text-8xl font-pixel text-atari-yellow mt-8"
                        style={{ textShadow: '0 0 30px #FFD700' }}
                    >
                        {countdown}
                    </motion.div>
                )}
            </div>

            {/* Target color display (with Stroop effect) */}
            {phase === 'PLAYING' && targetColor && displayColor && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-lg text-white/50 mb-4">TAP THE COLOR:</div>
                    <motion.div
                        key={round}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className={clsx(
                            "text-6xl md:text-8xl font-pixel",
                            displayColor.textColor // Stroop effect: display color might differ!
                        )}
                        style={{ textShadow: '0 4px 0 #000' }}
                    >
                        {targetColor.displayName}
                    </motion.div>

                    {roundWinner && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 text-xl text-atari-green"
                        >
                            {players.find(p => p.id === roundWinner)?.username} got it!
                        </motion.div>
                    )}

                    {feedback && (
                        <motion.div
                            initial={{ scale: 1.5 }}
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

            {/* Color buttons */}
            {phase === 'PLAYING' && (
                <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-4">
                    {COLORS.map((color) => (
                        <motion.button
                            key={color.name}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleColorClick(color)}
                            disabled={hasAnswered || !!roundWinner}
                            className={clsx(
                                "h-20 md:h-24 rounded-lg font-pixel text-xl text-white transition-all",
                                color.bgColor,
                                (hasAnswered || roundWinner) && "opacity-50 cursor-not-allowed"
                            )}
                            style={{ boxShadow: `0 4px 0 rgba(0,0,0,0.5)` }}
                        >
                            {color.displayName}
                        </motion.button>
                    ))}
                </div>
            )}

            {/* Scores */}
            <div className="w-full max-w-md">
                <div className="flex justify-center gap-4 pb-4">
                    {players.map(player => (
                        <div key={player.id} className={clsx(
                            "text-center px-4 py-2 rounded-lg",
                            player.id === currentPlayer?.id ? "bg-atari-green/20 border border-atari-green" : "bg-white/10"
                        )}>
                            <div className="text-sm text-white/70">{player.username}</div>
                            <div className="text-2xl font-pixel text-atari-cyan">
                                {scores.get(player.id) || 0}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Winner display */}
            {phase === 'ENDED' && winner && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/80"
                >
                    <div className="text-center">
                        <div className="text-6xl mb-4">🎨</div>
                        <div className="text-4xl font-pixel text-atari-green">
                            {players.find(p => p.id === winner)?.username} WINS!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default ColorMatch
