import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

const ARENA_RADIUS = 120
const SUMO_RADIUS = 25
const GAME_DURATION = 20000

const SumoSlap: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
    const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
        new Map(players.map((p, i) => [p.id, { x: i === 0 ? -50 : 50, y: 0 }]))
    )
    const [masses, setMasses] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 30])))
    const [alive, setAlive] = useState<Set<string>>(new Set(players.map(p => p.id)))
    const [winner, setWinner] = useState<string | null>(null)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const velocitiesRef = useRef<Map<string, { x: number; y: number }>>(new Map(players.map(p => [p.id, { x: 0, y: 0 }])))

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

    useEffect(() => {
        if (phase !== 'PLAYING') return
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 100) { clearInterval(interval); return 0 }
                return prev - 100
            })
        }, 100)
        return () => clearInterval(interval)
    }, [phase])

    // Physics simulation (host only)
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        const interval = setInterval(() => {
            setPositions(prev => {
                const next = new Map(prev)
                const newAlive = new Set(alive)

                for (const [playerId, pos] of prev) {
                    if (!alive.has(playerId)) continue

                    const vel = velocitiesRef.current.get(playerId) || { x: 0, y: 0 }

                    // Apply velocity
                    let newX = pos.x + vel.x
                    let newY = pos.y + vel.y

                    // Apply friction
                    vel.x *= 0.95
                    vel.y *= 0.95
                    velocitiesRef.current.set(playerId, vel)

                    // Check if out of ring
                    const distFromCenter = Math.sqrt(newX ** 2 + newY ** 2)
                    if (distFromCenter > ARENA_RADIUS - SUMO_RADIUS) {
                        newAlive.delete(playerId)
                        broadcastAndApply({ type: 'SUMO_FALL', playerId })
                    } else {
                        next.set(playerId, { x: newX, y: newY })
                    }
                }

                // Check collision between sumos
                const playerIds = [...alive]
                for (let i = 0; i < playerIds.length; i++) {
                    for (let j = i + 1; j < playerIds.length; j++) {
                        const p1 = next.get(playerIds[i])
                        const p2 = next.get(playerIds[j])
                        if (!p1 || !p2) continue

                        const dx = p2.x - p1.x
                        const dy = p2.y - p1.y
                        const dist = Math.sqrt(dx ** 2 + dy ** 2)
                        const minDist = SUMO_RADIUS * 2

                        if (dist < minDist) {
                            // Push apart based on mass
                            const m1 = masses.get(playerIds[i]) || 30
                            const m2 = masses.get(playerIds[j]) || 30
                            const totalMass = m1 + m2
                            const pushRatio1 = m2 / totalMass
                            const pushRatio2 = m1 / totalMass

                            const overlap = minDist - dist
                            const nx = dx / dist
                            const ny = dy / dist

                            const v1 = velocitiesRef.current.get(playerIds[i])!
                            const v2 = velocitiesRef.current.get(playerIds[j])!

                            v1.x -= nx * overlap * pushRatio1 * 0.5
                            v1.y -= ny * overlap * pushRatio1 * 0.5
                            v2.x += nx * overlap * pushRatio2 * 0.5
                            v2.y += ny * overlap * pushRatio2 * 0.5
                        }
                    }
                }

                if (newAlive.size !== alive.size) {
                    setAlive(newAlive)
                    if (newAlive.size <= 1 || timeLeft <= 0) {
                        const winnerId = newAlive.size > 0 ? [...newAlive][0] :
                            [...masses.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
                        broadcastAndApply({ type: 'SUMO_GAME_OVER', winnerId })
                    }
                }

                return next
            })
        }, 30)

        return () => clearInterval(interval)
    }, [phase, isHost, alive, masses, timeLeft, broadcastAndApply])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'SUMO_PUSH') {
            setMasses(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, (prev.get(lastBroadcast.playerId) || 30) + 2)
                return next
            })

            // Add push force
            const vel = velocitiesRef.current.get(lastBroadcast.playerId)
            if (vel) {
                vel.x += lastBroadcast.dx * 3
                vel.y += lastBroadcast.dy * 3
            }
        }

        if (lastBroadcast.type === 'SUMO_FALL') {
            setAlive(prev => {
                const next = new Set(prev)
                next.delete(lastBroadcast.playerId)
                return next
            })
            if (lastBroadcast.playerId === currentPlayer?.id) playFail()
        }

        if (lastBroadcast.type === 'SUMO_GAME_OVER') {
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    const handlePush = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        if (phase !== 'PLAYING' || !currentPlayer || !alive.has(currentPlayer.id)) return

        playTap()
        const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0
        const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0

        broadcastAndApply({ type: 'SUMO_PUSH', playerId: currentPlayer.id, dx, dy })
    }, [phase, currentPlayer, alive, broadcastAndApply])

    const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4']
    const amAlive = currentPlayer ? alive.has(currentPlayer.id) : false

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-amber-700 to-amber-900 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🤼 SUMO!</h1>
                {phase === 'PLAYING' && <div className="text-xl text-yellow-400">{(timeLeft / 1000).toFixed(1)}s</div>}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && (
                <div
                    className="relative rounded-full bg-amber-600 border-8 border-amber-800"
                    style={{ width: ARENA_RADIUS * 2 + 20, height: ARENA_RADIUS * 2 + 20 }}
                >
                    {/* Sumos */}
                    {players.map((player, idx) => {
                        const pos = positions.get(player.id) || { x: 0, y: 0 }
                        const mass = masses.get(player.id) || 30
                        const isAlive = alive.has(player.id)

                        return (
                            <motion.div
                                key={player.id}
                                animate={{
                                    left: ARENA_RADIUS + 10 + pos.x - mass / 2,
                                    top: ARENA_RADIUS + 10 + pos.y - mass / 2,
                                    opacity: isAlive ? 1 : 0
                                }}
                                className="absolute rounded-full flex items-center justify-center text-xl font-bold"
                                style={{
                                    width: mass,
                                    height: mass,
                                    backgroundColor: PLAYER_COLORS[idx],
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                                }}
                            >
                                🤼
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Controls */}
            {phase === 'PLAYING' && amAlive && (
                <div className="grid grid-cols-3 gap-2 pb-4">
                    <div />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handlePush('up')}
                        className="w-16 h-16 bg-amber-600 rounded-xl text-2xl">⬆️</motion.button>
                    <div />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handlePush('left')}
                        className="w-16 h-16 bg-amber-600 rounded-xl text-2xl">⬅️</motion.button>
                    <div />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handlePush('right')}
                        className="w-16 h-16 bg-amber-600 rounded-xl text-2xl">➡️</motion.button>
                    <div />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handlePush('down')}
                        className="w-16 h-16 bg-amber-600 rounded-xl text-2xl">⬇️</motion.button>
                </div>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🤼</div>
                        <div className="text-4xl font-pixel text-amber-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default SumoSlap
