import { useEffect, useState, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playCountdownBeep, playWinFanfare, playFail, playGunshot, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

const ARENA_WIDTH = 300
const ARENA_HEIGHT = 200
const TANK_SIZE = 20
const BULLET_SPEED = 5
const GAME_DURATION = 15000 // 15 seconds

interface TankState {
    x: number
    y: number
    angle: number // 0-360 degrees
    health: number
    lastShot: number
}

interface Bullet {
    id: string
    x: number
    y: number
    angle: number
    ownerId: string
}

const TankBattle: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
    const [tanks, setTanks] = useState<Map<string, TankState>>(new Map())
    const [bullets, setBullets] = useState<Bullet[]>([])
    const [winner, setWinner] = useState<string | null>(null)
    const [score, setScore] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const myTank = currentPlayer ? tanks.get(currentPlayer.id) : null

    // Initialize tanks
    useEffect(() => {
        const initialTanks = new Map<string, TankState>()
        players.forEach((p, i) => {
            initialTanks.set(p.id, {
                x: i === 0 ? 30 : ARENA_WIDTH - 30,
                y: ARENA_HEIGHT / 2,
                angle: i === 0 ? 0 : 180,
                health: 3,
                lastShot: 0
            })
        })
        setTanks(initialTanks)
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
                    if (isHost) endGame()
                    return 0
                }
                return prev - 100
            })
        }, 100)
        return () => clearInterval(interval)
    }, [phase, isHost])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'TANK_MOVE') {
            setTanks(prev => {
                const next = new Map(prev)
                const tank = next.get(lastBroadcast.playerId)
                if (tank) {
                    next.set(lastBroadcast.playerId, {
                        ...tank,
                        x: lastBroadcast.x,
                        y: lastBroadcast.y,
                        angle: lastBroadcast.angle
                    })
                }
                return next
            })
        }

        if (lastBroadcast.type === 'TANK_SHOOT') {
            playGunshot()
            setBullets(prev => [...prev, {
                id: lastBroadcast.bulletId,
                x: lastBroadcast.x,
                y: lastBroadcast.y,
                angle: lastBroadcast.angle,
                ownerId: lastBroadcast.playerId
            }])
        }

        if (lastBroadcast.type === 'TANK_HIT') {
            playFail()
            setTanks(prev => {
                const next = new Map(prev)
                const tank = next.get(lastBroadcast.targetId)
                if (tank) {
                    next.set(lastBroadcast.targetId, { ...tank, health: tank.health - 1 })
                }
                return next
            })
            setScore(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.shooterId, (prev.get(lastBroadcast.shooterId) || 0) + 1)
                return next
            })
        }

        if (lastBroadcast.type === 'TANK_GAME_OVER') {
            setPhase('ENDED')
            setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) {
                playWinFanfare()
            }
            if (isHost) {
                setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
            }
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    const endGame = () => {
        // Winner is player with most hits or most health remaining
        const sortedByScore = [...score.entries()].sort((a, b) => b[1] - a[1])
        const winnerId = sortedByScore[0]?.[0]
        broadcastAndApply({ type: 'TANK_GAME_OVER', winnerId })
    }

    // Movement controls
    const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right' | 'shoot') => {
        if (phase !== 'PLAYING' || !currentPlayer || !myTank) return

        if (direction === 'shoot') {
            const now = Date.now()
            if (now - myTank.lastShot < 500) return // Cooldown

            const bulletId = `${currentPlayer.id}_${now}`
            const radians = myTank.angle * (Math.PI / 180)

            broadcastAndApply({
                type: 'TANK_SHOOT',
                playerId: currentPlayer.id,
                bulletId,
                x: myTank.x + Math.cos(radians) * TANK_SIZE,
                y: myTank.y + Math.sin(radians) * TANK_SIZE,
                angle: myTank.angle
            })

            setTanks(prev => {
                const next = new Map(prev)
                next.set(currentPlayer.id, { ...myTank, lastShot: now })
                return next
            })
            return
        }

        let newX = myTank.x
        let newY = myTank.y
        let newAngle = myTank.angle
        const speed = 5

        switch (direction) {
            case 'up': newY = Math.max(TANK_SIZE, myTank.y - speed); break
            case 'down': newY = Math.min(ARENA_HEIGHT - TANK_SIZE, myTank.y + speed); break
            case 'left': newAngle = (myTank.angle - 15 + 360) % 360; break
            case 'right': newAngle = (myTank.angle + 15) % 360; break
        }

        broadcastAndApply({
            type: 'TANK_MOVE',
            playerId: currentPlayer.id,
            x: newX,
            y: newY,
            angle: newAngle
        })
    }, [phase, currentPlayer, myTank, broadcastAndApply])

    // Bullet movement and collision (host only)
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        const interval = setInterval(() => {
            setBullets(prev => {
                const newBullets: Bullet[] = []

                for (const bullet of prev) {
                    const radians = bullet.angle * (Math.PI / 180)
                    const newX = bullet.x + Math.cos(radians) * BULLET_SPEED
                    const newY = bullet.y + Math.sin(radians) * BULLET_SPEED

                    // Out of bounds
                    if (newX < 0 || newX > ARENA_WIDTH || newY < 0 || newY > ARENA_HEIGHT) continue

                    // Check collision with tanks
                    let hit = false
                    for (const [playerId, tank] of tanks) {
                        if (playerId === bullet.ownerId) continue
                        const dist = Math.sqrt((newX - tank.x) ** 2 + (newY - tank.y) ** 2)
                        if (dist < TANK_SIZE) {
                            broadcastAndApply({
                                type: 'TANK_HIT',
                                shooterId: bullet.ownerId,
                                targetId: playerId
                            })
                            hit = true
                            break
                        }
                    }

                    if (!hit) {
                        newBullets.push({ ...bullet, x: newX, y: newY })
                    }
                }

                return newBullets
            })
        }, 50)

        return () => clearInterval(interval)
    }, [phase, isHost, tanks, broadcastAndApply])

    const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3']

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-green-900 to-green-950 select-none p-4">
            {/* Header */}
            <div className="text-center pt-2">
                <h1 className="text-2xl md:text-4xl font-pixel text-white mb-2" style={{ textShadow: '0 0 15px #FF0' }}>
                    🎖️ TANK BATTLE!
                </h1>
                {phase === 'COUNTDOWN' && (
                    <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-6xl font-pixel text-yellow-400">
                        {countdown}
                    </motion.div>
                )}
                {phase === 'PLAYING' && (
                    <div className="text-xl text-white">{(timeLeft / 1000).toFixed(1)}s</div>
                )}
            </div>

            {/* Arena */}
            <div
                className="relative bg-green-800 border-4 border-yellow-600 rounded-lg overflow-hidden"
                style={{ width: ARENA_WIDTH * 1.5, height: ARENA_HEIGHT * 1.5 }}
            >
                {/* Tanks */}
                {[...tanks.entries()].map(([playerId, tank], idx) => (
                    <motion.div
                        key={playerId}
                        className="absolute"
                        style={{
                            left: tank.x * 1.5 - TANK_SIZE,
                            top: tank.y * 1.5 - TANK_SIZE,
                            width: TANK_SIZE * 2,
                            height: TANK_SIZE * 2,
                        }}
                        animate={{ rotate: tank.angle }}
                    >
                        <div
                            className="w-full h-full rounded-sm"
                            style={{
                                backgroundColor: PLAYER_COLORS[idx % PLAYER_COLORS.length],
                                opacity: tank.health > 0 ? 1 : 0.3
                            }}
                        >
                            {/* Cannon */}
                            <div className="absolute top-1/2 left-1/2 w-3 h-6 bg-gray-700 -translate-y-1/2" />
                        </div>
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-white whitespace-nowrap">
                            ❤️{tank.health}
                        </div>
                    </motion.div>
                ))}

                {/* Bullets */}
                {bullets.map(bullet => (
                    <div
                        key={bullet.id}
                        className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                        style={{
                            left: bullet.x * 1.5 - 4,
                            top: bullet.y * 1.5 - 4,
                            boxShadow: '0 0 5px #FFD700'
                        }}
                    />
                ))}
            </div>

            {/* Controls */}
            {phase === 'PLAYING' && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                    <div />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('up')} className="w-12 h-12 bg-gray-700 rounded text-2xl">⬆️</motion.button>
                    <div />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('left')} className="w-12 h-12 bg-gray-700 rounded text-2xl">⬅️</motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('shoot')} className="w-12 h-12 bg-red-600 rounded text-xl">🔥</motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('right')} className="w-12 h-12 bg-gray-700 rounded text-2xl">➡️</motion.button>
                    <div />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('down')} className="w-12 h-12 bg-gray-700 rounded text-2xl">⬇️</motion.button>
                </div>
            )}

            {/* Scores */}
            <div className="flex gap-4 mt-2">
                {players.map((p, i) => (
                    <div key={p.id} className={clsx("text-center px-3 py-1 rounded", p.id === currentPlayer?.id && "border border-white")}>
                        <div className="text-sm" style={{ color: PLAYER_COLORS[i] }}>{p.username}</div>
                        <div className="text-lg text-yellow-400">{score.get(p.id) || 0} hits</div>
                    </div>
                ))}
            </div>

            {/* Winner */}
            {phase === 'ENDED' && winner && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🏆</div>
                        <div className="text-4xl font-pixel text-yellow-400">
                            {players.find(p => p.id === winner)?.username} WINS!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default TankBattle
