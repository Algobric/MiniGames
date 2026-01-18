import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

const GAME_DURATION = 20000 // 20 seconds
const GRAVITY = 0.3
const TILT_SPEED = 2

const BalanceBeam: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
    const [ballPositions, setBallPositions] = useState<Map<string, number>>(
        new Map(players.map(p => [p.id, 0])) // -1 to 1, 0 is center
    )
    const [tiltAngles, setTiltAngles] = useState<Map<string, number>>(
        new Map(players.map(p => [p.id, 0]))
    )
    const [alive, setAlive] = useState<Set<string>>(new Set(players.map(p => p.id)))
    const [winner, setWinner] = useState<string | null>(null)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const velocityRef = useRef<Map<string, number>>(new Map(players.map(p => [p.id, 0])))

    // Reset ref on mount
    useEffect(() => {
        velocityRef.current = new Map(players.map(p => [p.id, 0]))
    }, [players])

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
                    return 0
                }
                return prev - 100
            })
        }, 100)
        return () => clearInterval(interval)
    }, [phase])

    // Physics simulation (host only)
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        const interval = setInterval(() => {
            setBallPositions(prev => {
                const next = new Map(prev)
                const newAlive = new Set(alive)
                let changed = false

                for (const [playerId, pos] of prev) {
                    if (!alive.has(playerId)) continue

                    const tilt = tiltAngles.get(playerId) || 0
                    let vel = velocityRef.current.get(playerId) || 0

                    // Apply gravity based on tilt
                    vel += Math.sin(tilt * Math.PI / 180) * GRAVITY
                    vel *= 0.98 // Friction

                    let newPos = pos + vel * 0.02

                    // Check if fallen off
                    if (Math.abs(newPos) > 1) {
                        newAlive.delete(playerId)
                        changed = true
                        playFail()
                        broadcastAndApply({ type: 'BALANCE_FALL', playerId })
                    } else {
                        velocityRef.current.set(playerId, vel)
                        next.set(playerId, newPos)
                    }
                }

                if (changed) {
                    setAlive(newAlive)

                    // Check win condition
                    if (newAlive.size <= 1 || timeLeft <= 0) {
                        const winnerId = [...newAlive][0] || null
                        broadcastAndApply({ type: 'BALANCE_GAME_OVER', winnerId })
                    }
                }

                return next
            })
        }, 16)

        return () => clearInterval(interval)
    }, [phase, isHost, alive, tiltAngles, timeLeft, broadcastAndApply])

    // Check timeout
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost || timeLeft > 0) return

        const alivePlayers = [...alive]
        if (alivePlayers.length > 0) {
            // Winner is whoever is still alive
            const winnerId = alivePlayers[0]
            broadcastAndApply({ type: 'BALANCE_GAME_OVER', winnerId })
        }
    }, [phase, isHost, timeLeft, alive, broadcastAndApply])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'BALANCE_TILT') {
            setTiltAngles(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.angle)
                return next
            })
        }

        if (lastBroadcast.type === 'BALANCE_FALL') {
            setAlive(prev => {
                const next = new Set(prev)
                next.delete(lastBroadcast.playerId)
                return next
            })
        }

        if (lastBroadcast.type === 'BALANCE_GAME_OVER') {
            setPhase('ENDED')
            setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    const handleTilt = useCallback((direction: 'left' | 'right') => {
        if (phase !== 'PLAYING' || !currentPlayer || !alive.has(currentPlayer.id)) return

        playTap()
        const currentAngle = tiltAngles.get(currentPlayer.id) || 0
        const newAngle = direction === 'left'
            ? Math.max(-30, currentAngle - TILT_SPEED)
            : Math.min(30, currentAngle + TILT_SPEED)

        setTiltAngles(prev => {
            const next = new Map(prev)
            next.set(currentPlayer.id, newAngle)
            return next
        })

        broadcastAndApply({
            type: 'BALANCE_TILT',
            playerId: currentPlayer.id,
            angle: newAngle
        })
    }, [phase, currentPlayer, alive, tiltAngles, broadcastAndApply])

    const myPosition = currentPlayer ? ballPositions.get(currentPlayer.id) || 0 : 0
    const myTilt = currentPlayer ? tiltAngles.get(currentPlayer.id) || 0 : 0
    const amAlive = currentPlayer ? alive.has(currentPlayer.id) : false

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-sky-400 to-sky-700 select-none p-4">
            {/* Header */}
            <div className="text-center pt-2">
                <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2" style={{ textShadow: '0 2px 0 #000' }}>
                    ⚖️ BALANCE BEAM!
                </h1>
                {phase === 'PLAYING' && (
                    <div className="text-xl text-yellow-300">{(timeLeft / 1000).toFixed(1)}s</div>
                )}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">
                    {countdown}
                </motion.div>
            )}

            {/* Beam area */}
            {phase === 'PLAYING' && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    {/* My beam */}
                    <div className="relative mb-8">
                        <div className="text-sm text-white mb-2 text-center">
                            {currentPlayer?.username} {!amAlive && '(FELL!)'}
                        </div>
                        <motion.div
                            animate={{ rotate: myTilt }}
                            className={clsx(
                                "relative w-64 h-3 rounded-full",
                                amAlive ? "bg-amber-600" : "bg-gray-500"
                            )}
                            style={{ transformOrigin: 'center center' }}
                        >
                            {/* Ball */}
                            {amAlive && (
                                <motion.div
                                    className="absolute top-0 w-5 h-5 bg-red-500 rounded-full -translate-y-full"
                                    style={{
                                        left: `${50 + myPosition * 45}%`,
                                        transform: 'translateX(-50%) translateY(-100%)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                    }}
                                />
                            )}
                        </motion.div>
                        {/* Pivot */}
                        <div className="w-4 h-8 bg-amber-800 mx-auto" />
                    </div>

                    {/* Other players */}
                    <div className="flex gap-8">
                        {players.filter(p => p.id !== currentPlayer?.id).map(player => {
                            const pos = ballPositions.get(player.id) || 0
                            const tilt = tiltAngles.get(player.id) || 0
                            const isAlive = alive.has(player.id)
                            return (
                                <div key={player.id} className="text-center">
                                    <div className="text-xs text-white mb-1">
                                        {player.username} {!isAlive && '💀'}
                                    </div>
                                    <motion.div
                                        animate={{ rotate: tilt }}
                                        className={clsx(
                                            "relative w-24 h-2 rounded-full",
                                            isAlive ? "bg-amber-600" : "bg-gray-500"
                                        )}
                                    >
                                        {isAlive && (
                                            <div
                                                className="absolute top-0 w-3 h-3 bg-blue-500 rounded-full -translate-y-full"
                                                style={{
                                                    left: `${50 + pos * 45}%`,
                                                    transform: 'translateX(-50%) translateY(-100%)'
                                                }}
                                            />
                                        )}
                                    </motion.div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Controls */}
            {phase === 'PLAYING' && amAlive && (
                <div className="flex gap-8 pb-4">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onPointerDown={() => handleTilt('left')}
                        className="w-20 h-20 bg-amber-600 rounded-xl text-3xl shadow-lg"
                    >
                        ⬅️
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onPointerDown={() => handleTilt('right')}
                        className="w-20 h-20 bg-amber-600 rounded-xl text-3xl shadow-lg"
                    >
                        ➡️
                    </motion.button>
                </div>
            )}

            {!amAlive && phase === 'PLAYING' && (
                <div className="text-2xl text-red-300 pb-8">You fell off! Watching...</div>
            )}

            {/* Winner */}
            {phase === 'ENDED' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">⚖️</div>
                        <div className="text-4xl font-pixel text-yellow-400">
                            {winner ? `${players.find(p => p.id === winner)?.username} WINS!` : 'EVERYONE FELL!'}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default BalanceBeam
