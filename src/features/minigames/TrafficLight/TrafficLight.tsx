import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'
type Light = 'RED' | 'YELLOW' | 'GREEN'

const FINISH_LINE = 100

const TrafficLight: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [light, setLight] = useState<Light>('RED')
    const [positions, setPositions] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [isHolding, setIsHolding] = useState(false)
    const [winner, setWinner] = useState<string | null>(null)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const lightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const handleInteraction = () => { unlockAudio(); window.removeEventListener('pointerdown', handleInteraction) }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    useEffect(() => {
        if (phase !== 'COUNTDOWN') return
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(interval); playCountdownBeep(true); setPhase('PLAYING'); return 0 }
                playCountdownBeep(false); return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase])

    // Light cycle (host controls)
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        const cycleLight = () => {
            const duration = Math.random() * 2000 + 1500 // 1.5-3.5 seconds
            const nextLight: Light = light === 'GREEN' ? 'RED' : 'GREEN'

            lightTimerRef.current = setTimeout(() => {
                broadcastAndApply({ type: 'TRAFFIC_LIGHT', light: nextLight })
                cycleLight()
            }, duration)
        }

        // Start with green
        broadcastAndApply({ type: 'TRAFFIC_LIGHT', light: 'GREEN' })
        cycleLight()

        return () => {
            if (lightTimerRef.current) clearTimeout(lightTimerRef.current)
        }
    }, [phase, isHost])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'TRAFFIC_LIGHT') {
            setLight(lastBroadcast.light)
        }

        if (lastBroadcast.type === 'TRAFFIC_MOVE') {
            setPositions(prev => {
                const next = new Map(prev)
                const newPos = Math.min(FINISH_LINE, (prev.get(lastBroadcast.playerId) || 0) + 2)
                next.set(lastBroadcast.playerId, newPos)

                // Check win
                if (newPos >= FINISH_LINE && isHost) {
                    broadcastAndApply({ type: 'TRAFFIC_GAME_OVER', winnerId: lastBroadcast.playerId })
                }

                return next
            })
        }

        if (lastBroadcast.type === 'TRAFFIC_VIOLATION') {
            if (lastBroadcast.playerId === currentPlayer?.id) playFail()
            setPositions(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, 0) // Reset to start
                return next
            })
        }

        if (lastBroadcast.type === 'TRAFFIC_GAME_OVER') {
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd, broadcastAndApply])

    // Move while holding on green
    useEffect(() => {
        if (phase !== 'PLAYING' || !currentPlayer) return
        if (!isHolding) return

        const interval = setInterval(() => {
            if (light === 'GREEN') {
                playTap()
                broadcastAndApply({ type: 'TRAFFIC_MOVE', playerId: currentPlayer.id })
            } else if (light === 'RED') {
                // Violation!
                broadcastAndApply({ type: 'TRAFFIC_VIOLATION', playerId: currentPlayer.id })
                setIsHolding(false)
            }
        }, 100)

        return () => clearInterval(interval)
    }, [phase, currentPlayer, isHolding, light, broadcastAndApply])

    const handleDown = useCallback(() => {
        setIsHolding(true)
    }, [])

    const handleUp = useCallback(() => {
        setIsHolding(false)
    }, [])

    const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3']

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-gray-700 to-gray-900 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🚦 SEMÁFORO!</h1>
                <p className="text-sm text-white/70">Mantén presionado en VERDE, suelta en ROJO</p>
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && (
                <>
                    {/* Traffic light */}
                    <div className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-xl">
                        <motion.div
                            animate={{ scale: light === 'RED' ? 1.2 : 0.8, opacity: light === 'RED' ? 1 : 0.3 }}
                            className="w-16 h-16 rounded-full bg-red-600"
                            style={{ boxShadow: light === 'RED' ? '0 0 30px #FF0000' : 'none' }}
                        />
                        <motion.div
                            animate={{ scale: light === 'YELLOW' ? 1.2 : 0.8, opacity: light === 'YELLOW' ? 1 : 0.3 }}
                            className="w-16 h-16 rounded-full bg-yellow-500"
                        />
                        <motion.div
                            animate={{ scale: light === 'GREEN' ? 1.2 : 0.8, opacity: light === 'GREEN' ? 1 : 0.3 }}
                            className="w-16 h-16 rounded-full bg-green-500"
                            style={{ boxShadow: light === 'GREEN' ? '0 0 30px #00FF00' : 'none' }}
                        />
                    </div>

                    {/* Race track */}
                    <div className="w-full max-w-md">
                        {players.map((player, idx) => {
                            const pos = positions.get(player.id) || 0
                            return (
                                <div key={player.id} className="mb-4">
                                    <div className="flex justify-between text-sm text-white mb-1">
                                        <span>{player.username}</span>
                                        <span>{Math.round(pos)}%</span>
                                    </div>
                                    <div className="relative h-8 bg-gray-600 rounded-full overflow-hidden">
                                        <div className="absolute right-0 w-2 h-full bg-yellow-400" />
                                        <motion.div
                                            animate={{ left: `${pos}%` }}
                                            className="absolute top-1 w-6 h-6 rounded-full"
                                            style={{ backgroundColor: PLAYER_COLORS[idx % PLAYER_COLORS.length] }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {phase === 'PLAYING' && (
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onPointerDown={handleDown}
                    onPointerUp={handleUp}
                    onPointerLeave={handleUp}
                    className={clsx(
                        "px-16 py-8 text-2xl font-pixel rounded-xl shadow-lg mb-4 transition-colors",
                        isHolding ? "bg-green-500" : "bg-gray-600"
                    )}
                >
                    {isHolding ? '🏃 CORRIENDO...' : '👆 MANTENER PARA CORRER'}
                </motion.button>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🏁</div>
                        <div className="text-4xl font-pixel text-green-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default TrafficLight
