import { useEffect, useState, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

interface Meteor {
    id: string
    x: number
    y: number
    speed: number
    size: number
}

const GAME_DURATION = 20000

const MeteorRain: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
    const [meteors, setMeteors] = useState<Meteor[]>([])
    const [playerPositions, setPlayerPositions] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 50])))
    const [alive, setAlive] = useState<Set<string>>(new Set(players.map(p => p.id)))
    const [winner, setWinner] = useState<string | null>(null)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const amAlive = currentPlayer ? alive.has(currentPlayer.id) : false

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

    // Game timer
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

    // Spawn meteors (host only)
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        const spawnMeteor = () => {
            const meteor: Meteor = {
                id: `meteor_${Date.now()}_${Math.random()}`,
                x: Math.random() * 80 + 10, // 10-90%
                y: -10,
                speed: 2 + Math.random() * 3,
                size: 20 + Math.random() * 30
            }
            broadcastAndApply({ type: 'METEOR_SPAWN', meteor })
        }

        const interval = setInterval(spawnMeteor, 500)
        return () => clearInterval(interval)
    }, [phase, isHost, broadcastAndApply])

    // Move meteors and check collisions (host only)
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        const interval = setInterval(() => {
            setMeteors(prev => {
                const next: Meteor[] = []

                for (const meteor of prev) {
                    const newY = meteor.y + meteor.speed

                    // Remove if off screen
                    if (newY > 110) continue

                    // Check collision with players at ground level (y = 85-100)
                    if (newY >= 75 && newY <= 100) {
                        for (const [playerId, playerX] of playerPositions) {
                            if (!alive.has(playerId)) continue

                            const dist = Math.abs(meteor.x - playerX)
                            const hitRadius = (meteor.size / 2 + 15) / 2

                            if (dist < hitRadius) {
                                broadcastAndApply({ type: 'METEOR_HIT', playerId })
                            }
                        }
                    }

                    next.push({ ...meteor, y: newY })
                }

                return next
            })
        }, 50)

        return () => clearInterval(interval)
    }, [phase, isHost, playerPositions, alive, broadcastAndApply])

    // Check game end
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        if (alive.size <= 1 || timeLeft <= 0) {
            const winnerId = alive.size > 0 ? [...alive][0] : null
            broadcastAndApply({ type: 'METEOR_GAME_OVER', winnerId })
        }
    }, [phase, isHost, alive, timeLeft, broadcastAndApply])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'METEOR_SPAWN') {
            setMeteors(prev => [...prev, lastBroadcast.meteor])
        }

        if (lastBroadcast.type === 'METEOR_MOVE') {
            setPlayerPositions(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.x)
                return next
            })
        }

        if (lastBroadcast.type === 'METEOR_HIT') {
            setAlive(prev => {
                const next = new Set(prev)
                next.delete(lastBroadcast.playerId)
                return next
            })
            if (lastBroadcast.playerId === currentPlayer?.id) playFail()
        }

        if (lastBroadcast.type === 'METEOR_GAME_OVER') {
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    const handleMove = useCallback((direction: 'left' | 'right') => {
        if (phase !== 'PLAYING' || !currentPlayer || !amAlive) return

        const currentX = playerPositions.get(currentPlayer.id) || 50
        const newX = direction === 'left'
            ? Math.max(5, currentX - 8)
            : Math.min(95, currentX + 8)

        playTap()
        setPlayerPositions(prev => { const next = new Map(prev); next.set(currentPlayer.id, newX); return next })
        broadcastAndApply({ type: 'METEOR_MOVE', playerId: currentPlayer.id, x: newX })
    }, [phase, currentPlayer, amAlive, playerPositions, broadcastAndApply])

    const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3']

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-gray-900 to-black select-none overflow-hidden">
            <div className="text-center pt-2 z-10">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>☄️ LLUVIA DE METEORITOS!</h1>
                {phase === 'PLAYING' && <div className="text-xl text-yellow-400">{(timeLeft / 1000).toFixed(1)}s - Vivos: {alive.size}</div>}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400 z-10">{countdown}</motion.div>
            )}

            {/* Game area */}
            {phase !== 'COUNTDOWN' && (
                <div className="relative flex-1 w-full">
                    {/* Meteors */}
                    {meteors.map(meteor => (
                        <motion.div
                            key={meteor.id}
                            className="absolute rounded-full bg-orange-500"
                            style={{
                                left: `${meteor.x}%`,
                                top: `${meteor.y}%`,
                                width: meteor.size,
                                height: meteor.size,
                                transform: 'translate(-50%, -50%)',
                                boxShadow: '0 0 20px #FF6600, 0 0 40px #FF3300'
                            }}
                        >
                            <div className="absolute inset-2 rounded-full bg-yellow-400" />
                        </motion.div>
                    ))}

                    {/* Ground */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-900 to-green-800" />

                    {/* Players */}
                    {players.map((player, idx) => {
                        const x = playerPositions.get(player.id) || 50
                        const isAlive = alive.has(player.id)
                        const isMe = player.id === currentPlayer?.id

                        return (
                            <motion.div
                                key={player.id}
                                animate={{ left: `${x}%`, opacity: isAlive ? 1 : 0.3 }}
                                className="absolute bottom-16"
                                style={{ transform: 'translateX(-50%)' }}
                            >
                                <div
                                    className={clsx("text-3xl", isMe && "drop-shadow-[0_0_10px_white]")}
                                >
                                    {isAlive ? '🏃' : '💀'}
                                </div>
                                <div
                                    className="text-xs text-center mt-1"
                                    style={{ color: PLAYER_COLORS[idx % PLAYER_COLORS.length] }}
                                >
                                    {player.username}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {/* Controls */}
            {phase === 'PLAYING' && amAlive && (
                <div className="flex gap-8 pb-4 z-10">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('left')}
                        className="w-20 h-20 bg-gray-700 rounded-xl text-3xl shadow-lg">⬅️</motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('right')}
                        className="w-20 h-20 bg-gray-700 rounded-xl text-3xl shadow-lg">➡️</motion.button>
                </div>
            )}

            {phase === 'ENDED' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                    <div className="text-center">
                        <div className="text-6xl mb-4">☄️</div>
                        <div className="text-4xl font-pixel text-orange-400">
                            {winner ? `${players.find(p => p.id === winner)?.username} SOBREVIVE!` : 'TODOS CAYERON!'}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default MeteorRain
