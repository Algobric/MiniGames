import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { useFairTiming } from '../../../hooks/useFairTiming'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'WAITING' | 'REACT' | 'ENDED'

const TOTAL_ROUNDS = 5

const ReactionRace: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()
    const { getServerTimestamp } = useFairTiming()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [round, setRound] = useState(0)
    const [, setTargetVisible] = useState(false)
    const [targetAppearTime, setTargetAppearTime] = useState(0)
    const [scores, setScores] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [roundWinner, setRoundWinner] = useState<string | null>(null)
    const [winner, setWinner] = useState<string | null>(null)
    const [hasClicked, setHasClicked] = useState(false)
    const [myReactionTime, setMyReactionTime] = useState<number | null>(null)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
                    playCountdownBeep(true)
                    if (isHost) startNewRound()
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase, isHost])

    const startNewRound = useCallback(() => {
        const newRound = round + 1
        if (newRound > TOTAL_ROUNDS) {
            // Game over
            const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1])
            const winnerId = sortedScores[0]?.[0]
            broadcastAndApply({ type: 'RACE_GAME_OVER', winnerId })
            return
        }

        const delay = Math.random() * 3000 + 1500 // 1.5-4.5 seconds
        broadcastAndApply({ type: 'RACE_NEW_ROUND', round: newRound, delay })
    }, [round, scores, broadcastAndApply])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'RACE_NEW_ROUND') {
            setRound(lastBroadcast.round)
            setPhase('WAITING')
            setTargetVisible(false)
            setRoundWinner(null)
            setHasClicked(false)
            setMyReactionTime(null)

            // Schedule target appearance
            timerRef.current = setTimeout(() => {
                const appearTime = Date.now()
                setTargetAppearTime(appearTime)
                setTargetVisible(true)
                setPhase('REACT')
                playTap()

                if (isHost) {
                    broadcastAndApply({ type: 'RACE_TARGET_SHOWN', appearTime })
                }
            }, lastBroadcast.delay)
        }

        if (lastBroadcast.type === 'RACE_TARGET_SHOWN') {
            setTargetAppearTime(lastBroadcast.appearTime)
            setTargetVisible(true)
            setPhase('REACT')
        }

        if (lastBroadcast.type === 'RACE_CLICK') {
            if (!roundWinner) {
                setRoundWinner(lastBroadcast.playerId)
                setScores(prev => {
                    const next = new Map(prev)
                    next.set(lastBroadcast.playerId, (prev.get(lastBroadcast.playerId) || 0) + 1)
                    return next
                })

                if (isHost) {
                    setTimeout(() => startNewRound(), 2000)
                }
            }
        }

        if (lastBroadcast.type === 'RACE_GAME_OVER') {
            setPhase('ENDED')
            setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) {
                playWinFanfare()
            }
            if (isHost) {
                setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
            }
        }
    }, [lastBroadcast, roundWinner, isHost, currentPlayer?.id, startNewRound, onGameEnd, broadcastAndApply])

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const handleClick = useCallback(() => {
        if (phase !== 'REACT' || !currentPlayer || hasClicked || roundWinner) return

        const clickTime = getServerTimestamp()
        const reactionTime = clickTime - targetAppearTime

        setHasClicked(true)
        setMyReactionTime(reactionTime)
        playTap()

        broadcastAndApply({
            type: 'RACE_CLICK',
            playerId: currentPlayer.id,
            reactionTime
        })
    }, [phase, currentPlayer, hasClicked, roundWinner, targetAppearTime, getServerTimestamp, broadcastAndApply])

    return (
        <div
            className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-blue-900 to-black select-none p-4"
            onClick={handleClick}
        >
            {/* Header */}
            <div className="text-center pt-4">
                <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2" style={{ textShadow: '0 0 15px #00F' }}>
                    ⚡ REACTION RACE!
                </h1>
                {phase !== 'COUNTDOWN' && phase !== 'ENDED' && (
                    <div className="text-lg text-white/70">Round {round} / {TOTAL_ROUNDS}</div>
                )}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-8xl font-pixel text-yellow-400">
                    {countdown}
                </motion.div>
            )}

            {/* Target area */}
            <div className="flex-1 flex items-center justify-center w-full">
                {phase === 'WAITING' && (
                    <div className="text-2xl text-white/50 animate-pulse">WAIT FOR THE TARGET...</div>
                )}

                {phase === 'REACT' && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="relative"
                    >
                        {!roundWinner && (
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 0.3 }}
                                className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-red-500 flex items-center justify-center cursor-pointer"
                                style={{ boxShadow: '0 0 30px #FF0000' }}
                            >
                                <span className="text-4xl md:text-6xl">👆</span>
                            </motion.div>
                        )}

                        {roundWinner && (
                            <div className="text-center">
                                <div className="text-4xl mb-4">✅</div>
                                <div className="text-2xl text-green-400">
                                    {players.find(p => p.id === roundWinner)?.username} got it!
                                </div>
                                {myReactionTime !== null && (
                                    <div className="text-lg text-cyan-400 mt-2">
                                        Your time: {myReactionTime}ms
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Scores */}
            <div className="flex gap-4 pb-4">
                {players.map(player => (
                    <div
                        key={player.id}
                        className={clsx(
                            "text-center px-4 py-2 rounded-lg",
                            player.id === currentPlayer?.id ? "bg-blue-700 border border-blue-400" : "bg-white/10"
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
                        <div className="text-6xl mb-4">⚡</div>
                        <div className="text-4xl font-pixel text-cyan-400">
                            {players.find(p => p.id === winner)?.username} WINS!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default ReactionRace
