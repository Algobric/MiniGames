import { useEffect, useState, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

interface Target {
    id: string
    x: number
    y: number
    size: number
    createdAt: number
}

const GAME_DURATION = 20000 // 20 seconds
const TARGET_LIFETIME = 2000 // 2 seconds per target
const TARGET_MIN_SIZE = 40
const TARGET_MAX_SIZE = 80

const TargetShoot: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
    const [targets, setTargets] = useState<Target[]>([])
    const [scores, setScores] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [winner, setWinner] = useState<string | null>(null)
    const [hitEffect, setHitEffect] = useState<{ x: number; y: number } | null>(null)

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
                    playCountdownBeep(true)
                    setPhase('PLAYING')
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase])

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
                        broadcastAndApply({ type: 'TARGET_GAME_OVER', winnerId })
                    }
                    return 0
                }
                return prev - 100
            })
        }, 100)
        return () => clearInterval(interval)
    }, [phase, isHost, scores, broadcastAndApply])

    // Spawn targets (host only)
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        const spawnTarget = () => {
            const id = `target_${Date.now()}`
            const size = Math.random() * (TARGET_MAX_SIZE - TARGET_MIN_SIZE) + TARGET_MIN_SIZE
            const x = Math.random() * (280 - size) + size / 2
            const y = Math.random() * (280 - size) + size / 2

            broadcastAndApply({
                type: 'TARGET_SPAWN',
                target: { id, x, y, size, createdAt: Date.now() }
            })
        }

        // Spawn first target immediately
        spawnTarget()

        // Keep spawning
        const interval = setInterval(() => {
            if (targets.length < 3) { // Max 3 targets at once
                spawnTarget()
            }
        }, 1500)

        return () => clearInterval(interval)
    }, [phase, isHost, targets.length, broadcastAndApply])

    // Remove expired targets
    useEffect(() => {
        if (phase !== 'PLAYING') return

        const interval = setInterval(() => {
            const now = Date.now()
            setTargets(prev => prev.filter(t => now - t.createdAt < TARGET_LIFETIME))
        }, 100)

        return () => clearInterval(interval)
    }, [phase])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'TARGET_SPAWN') {
            setTargets(prev => [...prev, lastBroadcast.target])
        }

        if (lastBroadcast.type === 'TARGET_HIT') {
            setTargets(prev => prev.filter(t => t.id !== lastBroadcast.targetId))
            setScores(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, (prev.get(lastBroadcast.playerId) || 0) + lastBroadcast.points)
                return next
            })
            if (lastBroadcast.playerId === currentPlayer?.id) {
                playTap()
            }
        }

        if (lastBroadcast.type === 'TARGET_GAME_OVER') {
            setPhase('ENDED')
            setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            else playFail()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    const handleTargetClick = useCallback((target: Target, e: React.MouseEvent) => {
        e.stopPropagation()
        if (phase !== 'PLAYING' || !currentPlayer) return

        // Calculate points based on size (smaller = more points)
        const points = Math.round((TARGET_MAX_SIZE - target.size + TARGET_MIN_SIZE) / 10)

        setHitEffect({ x: target.x, y: target.y })
        setTimeout(() => setHitEffect(null), 200)

        broadcastAndApply({
            type: 'TARGET_HIT',
            playerId: currentPlayer.id,
            targetId: target.id,
            points
        })
    }, [phase, currentPlayer, broadcastAndApply])

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-orange-900 to-red-950 select-none p-4">
            {/* Header */}
            <div className="text-center pt-2">
                <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2" style={{ textShadow: '0 0 15px #F80' }}>
                    🎯 TARGET SHOOT!
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

            {/* Target area */}
            {phase === 'PLAYING' && (
                <div className="relative w-72 h-72 md:w-96 md:h-96 bg-black/30 border-4 border-orange-600 rounded-lg overflow-hidden">
                    {targets.map(target => {
                        const lifeProgress = (Date.now() - target.createdAt) / TARGET_LIFETIME
                        return (
                            <motion.button
                                key={target.id}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 - lifeProgress * 0.3 }}
                                className="absolute rounded-full bg-red-500 hover:bg-red-400 cursor-crosshair"
                                style={{
                                    left: `${(target.x / 300) * 100}%`,
                                    top: `${(target.y / 300) * 100}%`,
                                    width: target.size,
                                    height: target.size,
                                    transform: 'translate(-50%, -50%)',
                                    boxShadow: `0 0 ${20 - lifeProgress * 15}px #FF0000`,
                                    opacity: 1 - lifeProgress * 0.5
                                }}
                                onClick={(e) => handleTargetClick(target, e)}
                            >
                                <div className="absolute inset-2 rounded-full bg-white" />
                                <div className="absolute inset-4 rounded-full bg-red-500" />
                                <div className="absolute inset-6 rounded-full bg-white" />
                            </motion.button>
                        )
                    })}

                    {/* Hit effect */}
                    {hitEffect && (
                        <motion.div
                            initial={{ scale: 0, opacity: 1 }}
                            animate={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute w-8 h-8 bg-yellow-400 rounded-full"
                            style={{
                                left: `${(hitEffect.x / 300) * 100}%`,
                                top: `${(hitEffect.y / 300) * 100}%`,
                                transform: 'translate(-50%, -50%)'
                            }}
                        />
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
                            player.id === currentPlayer?.id ? "bg-orange-700 border border-orange-400" : "bg-white/10"
                        )}
                    >
                        <div className="text-sm text-white/70">{player.username}</div>
                        <div className="text-2xl font-pixel text-yellow-400">{scores.get(player.id) || 0}</div>
                    </div>
                ))}
            </div>

            {/* Winner */}
            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🎯</div>
                        <div className="text-4xl font-pixel text-yellow-400">
                            {players.find(p => p.id === winner)?.username} WINS!
                        </div>
                        <div className="text-xl text-white/70 mt-2">
                            {scores.get(winner)} points
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default TargetShoot
