import { useEffect, useState, useRef, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'MASHING' | 'ENDED'



const GAME_DURATION = 5000 // 5 seconds of mashing

const ButtonMash: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
    const [tapCounts, setTapCounts] = useState<Map<string, number>>(
        new Map(players.map(p => [p.id, 0]))
    )
    const [winner, setWinner] = useState<string | null>(null)
    const [screenShake, setScreenShake] = useState(false)

    const startTimeRef = useRef<number>(0)
    const myTapsRef = useRef(0)
    const gameEndedRef = useRef(false)
    const lastBroadcastCountRef = useRef(0)
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

    // Countdown phase
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

    // Start mashing when countdown ends
    useEffect(() => {
        if (countdown === 0 && phase === 'COUNTDOWN') {
            playCountdownBeep(true)
            setPhase('MASHING')
            startTimeRef.current = Date.now()

            if (isHost) {
                broadcastAndApply({
                    type: 'MASH_START',
                    startTime: Date.now()
                })
            }
        }
    }, [countdown, phase, isHost, broadcastAndApply])

    // Timer during mashing
    useEffect(() => {
        if (phase !== 'MASHING') return

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current
            const remaining = Math.max(0, GAME_DURATION - elapsed)
            setTimeLeft(remaining)

            if (remaining === 0 && !gameEndedRef.current) {
                gameEndedRef.current = true
                clearInterval(interval)

                // Broadcast final count
                if (currentPlayer) {
                    broadcastAndApply({
                        type: 'MASH_FINAL',
                        playerId: currentPlayer.id,
                        count: myTapsRef.current
                    })
                }
            }
        }, 50)

        return () => clearInterval(interval)
    }, [phase, currentPlayer, broadcastAndApply])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'MASH_START') {
            startTimeRef.current = lastBroadcast.startTime
        }

        if (lastBroadcast.type === 'MASH_TAP') {
            setTapCounts(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.count)
                return next
            })
        }

        if (lastBroadcast.type === 'MASH_FINAL') {
            setTapCounts(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.count)
                return next
            })
        }

        if (lastBroadcast.type === 'MASH_RESULT') {
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
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    // Host determines winner after game ends
    useEffect(() => {
        if (!isHost || phase !== 'MASHING' || timeLeft > 0) return

        // Wait a bit for final counts to arrive
        const timeout = setTimeout(() => {
            const sortedCounts = [...tapCounts.entries()].sort((a, b) => b[1] - a[1])
            const winnerId = sortedCounts[0]?.[0]

            if (winnerId) {
                broadcastAndApply({
                    type: 'MASH_RESULT',
                    winnerId,
                    finalCounts: Object.fromEntries(tapCounts)
                })
            }
        }, 500)

        return () => clearTimeout(timeout)
    }, [isHost, phase, timeLeft, tapCounts, broadcastAndApply])

    // Handle tap
    const handleTap = useCallback(() => {
        if (phase !== 'MASHING' || !currentPlayer || gameEndedRef.current) return

        myTapsRef.current++
        playTap()
        setScreenShake(true)
        setTimeout(() => setScreenShake(false), 50)

        // Update local immediately
        setTapCounts(prev => {
            const next = new Map(prev)
            next.set(currentPlayer.id, myTapsRef.current)
            return next
        })

        // Broadcast every 5 taps to reduce network load
        if (myTapsRef.current - lastBroadcastCountRef.current >= 5) {
            lastBroadcastCountRef.current = myTapsRef.current
            broadcastAndApply({
                type: 'MASH_TAP',
                playerId: currentPlayer.id,
                count: myTapsRef.current
            })
        }
    }, [phase, currentPlayer, broadcastAndApply])

    // Sort players by tap count
    const sortedPlayers = [...players].sort((a, b) =>
        (tapCounts.get(b.id) || 0) - (tapCounts.get(a.id) || 0)
    )

    const maxTaps = Math.max(...[...tapCounts.values()], 1)

    return (
        <motion.div
            animate={screenShake ? { x: [0, -5, 5, -5, 5, 0] } : {}}
            transition={{ duration: 0.1 }}
            className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-purple-900 to-black select-none cursor-pointer p-4"
            onPointerDown={handleTap}
        >
            {/* Header */}
            <div className="text-center pt-4">
                <h1 className="text-3xl md:text-5xl font-pixel text-white mb-2"
                    style={{ textShadow: '0 0 20px #FF00FF' }}>
                    BUTTON MASH!
                </h1>

                {phase === 'COUNTDOWN' && (
                    <motion.div
                        key={countdown}
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-8xl md:text-9xl font-pixel text-atari-yellow"
                        style={{ textShadow: '0 0 30px #FFD700' }}
                    >
                        {countdown}
                    </motion.div>
                )}

                {phase === 'MASHING' && (
                    <div className="text-4xl md:text-6xl font-pixel text-red-400">
                        {(timeLeft / 1000).toFixed(1)}s
                    </div>
                )}

                {phase === 'ENDED' && winner && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-3xl font-pixel text-atari-green"
                    >
                        {players.find(p => p.id === winner)?.username} WINS!
                    </motion.div>
                )}
            </div>

            {/* Player progress bars */}
            <div className="flex-1 w-full max-w-2xl flex flex-col justify-center gap-4 py-4">
                {sortedPlayers.map((player, idx) => {
                    const count = tapCounts.get(player.id) || 0
                    const percentage = (count / maxTaps) * 100
                    const isMe = player.id === currentPlayer?.id

                    return (
                        <motion.div
                            key={player.id}
                            initial={{ x: -50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className="w-full"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={clsx(
                                    "font-pixel text-sm",
                                    isMe ? "text-atari-green" : "text-white"
                                )}>
                                    {player.username}
                                </span>
                                <span className="font-mono text-xl text-atari-cyan">
                                    {count}
                                </span>
                            </div>
                            <div className="h-8 bg-gray-800 rounded-full overflow-hidden border-2 border-gray-600">
                                <motion.div
                                    className={clsx(
                                        "h-full rounded-full",
                                        isMe ? "bg-atari-green" : "bg-atari-pink"
                                    )}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ type: 'spring', damping: 20 }}
                                    style={{ boxShadow: `0 0 10px ${isMe ? '#39ff14' : '#ff00ff'}` }}
                                />
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Tap zone indicator */}
            <div className="pb-8 text-center">
                {phase === 'MASHING' && (
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 0.2 }}
                        className="text-2xl font-pixel text-white/70"
                    >
                        TAP ANYWHERE!
                    </motion.div>
                )}

                {phase === 'COUNTDOWN' && (
                    <div className="text-xl text-white/50">
                        GET READY...
                    </div>
                )}
            </div>
        </motion.div>
    )
}

export default ButtonMash
