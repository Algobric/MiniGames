/**
 * TankBattle - Strategy and reflexes!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import { playWinFanfare, playGunshot } from '../HighNoon/sounds'

const ARENA_WIDTH = 300
const ARENA_HEIGHT = 200
const TANK_SIZE = 20
const BULLET_SPEED = 150
const MOVE_SPEED = 5
const ROT_SPEED = 15

interface Tank {
    id: string
    x: number
    y: number
    angle: number
    health: number
    lastShot: number
}

interface Bullet {
    id: string
    ownerId: string
    x: number // Start Pos
    y: number
    angle: number
    spawnTime: number
}

interface TankBattleState {
    tanks: Tank[]  // Changed from Map to array
    bullets: Bullet[]
    scores: { playerId: string; score: number }[]  // Changed from Map to array
}

// Helper functions for safe access
const getTank = (tanks: Tank[], id: string) => tanks.find(t => t.id === id)
const getScore = (scores: { playerId: string; score: number }[], id: string) =>
    scores.find(s => s.playerId === id)?.score || 0

const TankBattle = () => {
    const engine = useMinigameEngine<TankBattleState>({
        config: {
            countdownDuration: 3,
            gameDuration: 60
        },
        initialGameState: {
            tanks: [],
            bullets: [],
            scores: []
        },
        gameReducer: (state, event) => {
            // Ensure arrays exist (in case of sync issues)
            const tanks = Array.isArray(state.tanks) ? state.tanks : []
            const bullets = Array.isArray(state.bullets) ? state.bullets : []

            if (event.type === 'TANK_UPDATE') {
                const { x, y, angle } = event as any
                const tankIdx = tanks.findIndex(t => t.id === event.senderId)
                if (tankIdx === -1) return state
                const updatedTanks = [...tanks]
                updatedTanks[tankIdx] = { ...tanks[tankIdx], x, y, angle }
                return { ...state, tanks: updatedTanks }
            }
            if (event.type === 'TANK_SHOOT') {
                const { id, x, y, angle, spawnTime } = event as any
                const tankIdx = tanks.findIndex(t => t.id === event.senderId)
                if (tankIdx === -1) return state

                const updatedTanks = [...tanks]
                updatedTanks[tankIdx] = { ...tanks[tankIdx], lastShot: spawnTime }

                const nextBullets = [...bullets, {
                    id,
                    ownerId: event.senderId,
                    x, y, angle, spawnTime
                }]

                return { ...state, tanks: updatedTanks, bullets: nextBullets }
            }
            return state
        }
    })

    const {
        phase,
        countdown,
        gameState,
        winnerId,
        isPlaying,
        currentPlayerId,
        players,
        updateGameState,
        endGame,
        timeRemaining,
        dispatchGameEvent
    } = engine

    // Safely access state arrays
    const tanks = Array.isArray(gameState.tanks) ? gameState.tanks : []
    const bullets = Array.isArray(gameState.bullets) ? gameState.bullets : []
    const scores = Array.isArray(gameState.scores) ? gameState.scores : []

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const [localTank, setLocalTank] = useState<Tank | null>(null)
    const bulletIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const lastBroadcastRef = useRef<number>(0)

    // Init Tanks
    useEffect(() => {
        if (players.length > 0 && tanks.length === 0 && isPlaying) {
            const newTanks: Tank[] = players.map((p, i) => ({
                id: p.id,
                x: (i % 2 === 0) ? 30 : ARENA_WIDTH - 30,
                y: ARENA_HEIGHT / 2 + (i * 20),
                angle: (i % 2 === 0) ? 0 : 180,
                health: 3,
                lastShot: 0
            }))

            updateGameState(state => ({ ...state, tanks: newTanks }))
        }
    }, [players, isPlaying, tanks.length, updateGameState])

    // Sync Local Tank from GameState initially and when needed
    useEffect(() => {
        if (currentPlayerId) {
            const serverTank = getTank(tanks, currentPlayerId)
            if (serverTank && !localTank) {
                setLocalTank(serverTank)
            }
        }
    }, [currentPlayerId, tanks, localTank])

    // Bullet Physics (Leader)
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return

        bulletIntervalRef.current = setInterval(() => {
            updateGameState(state => {
                const stateTanks = Array.isArray(state.tanks) ? state.tanks : []
                const stateBullets = Array.isArray(state.bullets) ? state.bullets : []
                const stateScores = Array.isArray(state.scores) ? state.scores : []

                const now = Date.now()
                const nextBullets: Bullet[] = []
                let nextTanks = [...stateTanks]
                let nextScores = [...stateScores]
                let hitEvents = false

                for (const b of stateBullets) {
                    if (now - b.spawnTime > 3000) continue

                    const elapsed = (now - b.spawnTime) / 1000
                    const bx = b.x + Math.cos(b.angle * Math.PI / 180) * BULLET_SPEED * elapsed
                    const by = b.y + Math.sin(b.angle * Math.PI / 180) * BULLET_SPEED * elapsed

                    if (bx < 0 || bx > ARENA_WIDTH || by < 0 || by > ARENA_HEIGHT) continue

                    let hit = false
                    for (let i = 0; i < nextTanks.length; i++) {
                        const tank = nextTanks[i]
                        if (tank.health <= 0 || tank.id === b.ownerId) continue

                        const dist = Math.sqrt((bx - tank.x) ** 2 + (by - tank.y) ** 2)
                        if (dist < TANK_SIZE) {
                            hit = true
                            const newHealth = tank.health - 1
                            nextTanks = [...nextTanks]
                            nextTanks[i] = { ...tank, health: newHealth }

                            const scoreIdx = nextScores.findIndex(s => s.playerId === b.ownerId)
                            if (scoreIdx >= 0) {
                                nextScores = [...nextScores]
                                nextScores[scoreIdx] = { ...nextScores[scoreIdx], score: nextScores[scoreIdx].score + 1 }
                            } else {
                                nextScores = [...nextScores, { playerId: b.ownerId, score: 1 }]
                            }
                            hitEvents = true
                            break
                        }
                    }

                    if (!hit) nextBullets.push(b)
                }

                return hitEvents || nextBullets.length !== stateBullets.length
                    ? { ...state, bullets: nextBullets, tanks: nextTanks, scores: nextScores }
                    : state
            })
        }, 50)

        return () => { if (bulletIntervalRef.current) clearInterval(bulletIntervalRef.current) }
    }, [isPlaying, isLeader, winnerId, updateGameState])

    // Game End
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return

        const alive = tanks.filter(t => t.health > 0)

        if (players.length > 1 && alive.length <= 1) {
            const sorted = [...scores].sort((a, b) => b.score - a.score)
            const winner = alive.length > 0 ? alive[0].id : sorted[0]?.playerId || null
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        } else if (timeRemaining !== null && timeRemaining <= 0) {
            const sorted = [...scores].sort((a, b) => b.score - a.score)
            const winner = sorted[0]?.playerId || null
            if (winner === currentPlayerId) playWinFanfare()
            endGame(winner)
        }
    }, [tanks, scores, timeRemaining, players.length, isPlaying, isLeader, winnerId, currentPlayerId, endGame])


    // Input Handling
    const handleAction = useCallback((action: 'up' | 'down' | 'left' | 'right' | 'shoot') => {
        if (!isPlaying || !localTank || localTank.health <= 0) return

        if (action === 'shoot') {
            const now = Date.now()
            if (now - localTank.lastShot < 500) return // Cooldown

            playGunshot()
            // Dispatch Shoot
            // Calc Bullet Start
            const bx = localTank.x + Math.cos(localTank.angle * Math.PI / 180) * 25
            const by = localTank.y + Math.sin(localTank.angle * Math.PI / 180) * 25
            const bId = `b_${localTank.id}_${now}`

            dispatchGameEvent('TANK_SHOOT', {
                id: bId,
                x: bx,
                y: by,
                angle: localTank.angle,
                spawnTime: now
            })

            // Local optimistic update
            setLocalTank(prev => prev ? ({ ...prev, lastShot: now }) : null)

        } else {
            // Movement
            setLocalTank(prev => {
                if (!prev) return null
                let { x, y, angle } = prev
                if (action === 'left') angle = (angle - ROT_SPEED + 360) % 360
                if (action === 'right') angle = (angle + ROT_SPEED) % 360
                if (action === 'up') {
                    x += Math.cos(angle * Math.PI / 180) * MOVE_SPEED
                    y += Math.sin(angle * Math.PI / 180) * MOVE_SPEED
                }
                if (action === 'down') {
                    x -= Math.cos(angle * Math.PI / 180) * MOVE_SPEED
                    y -= Math.sin(angle * Math.PI / 180) * MOVE_SPEED
                }

                // Bounds
                x = Math.max(10, Math.min(ARENA_WIDTH - 10, x))
                y = Math.max(10, Math.min(ARENA_HEIGHT - 10, y))

                const next = { ...prev, x, y, angle }

                // Throttle broadcast to 100ms
                const now = Date.now()
                if (now - lastBroadcastRef.current > 100) {
                    lastBroadcastRef.current = now
                    dispatchGameEvent('TANK_UPDATE', { x, y, angle })
                }

                return next
            })
        }
    }, [isPlaying, localTank, dispatchGameEvent])


    const PLAYER_COLORS = ['#A3E635', '#60A5FA', '#F87171', '#FACC15']

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-green-900 to-stone-900"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🎖️ TANK BATTLE
                    </h1>
                </div>

                {/* Arena */}
                <div className="relative w-full max-w-lg aspect-video bg-stone-800 rounded-xl overflow-hidden border-4 border-stone-600 shadow-2xl">
                    {/* Tanks */}
                    {tanks.map((tank, idx) => {
                        const isMe = tank.id === currentPlayerId
                        const displayTank = (isMe && localTank) ? localTank : tank
                        if (displayTank.health <= 0) return null

                        return (
                            <motion.div
                                key={tank.id}
                                className="absolute w-8 h-8 flex items-center justify-center"
                                animate={{
                                    left: (displayTank.x / ARENA_WIDTH) * 100 + '%',
                                    top: (displayTank.y / ARENA_HEIGHT) * 100 + '%',
                                    rotate: displayTank.angle
                                }}
                                style={{ marginLeft: -16, marginTop: -16 }}
                                transition={{ type: 'tween', duration: isMe ? 0 : 0.1 }}
                            >
                                <div
                                    className="w-full h-full rounded border-2 border-black/50"
                                    style={{ backgroundColor: PLAYER_COLORS[idx % PLAYER_COLORS.length] }}
                                >
                                    <div className="absolute top-1/2 left-1/2 h-1.5 w-6 bg-black origin-left transform -translate-y-1/2" />
                                </div>
                                <div className="absolute -top-6 transform -rotate-0 text-xs text-white bg-black/50 px-1 rounded">
                                    hit:{getScore(scores, tank.id)}
                                </div>
                            </motion.div>
                        )
                    })}

                    {/* Bullets */}
                    {bullets.map(b => {
                        const elapsed = (Date.now() - b.spawnTime) / 1000
                        // Render logic: duplicate leader physics for smooth render
                        const dist = 150 * elapsed
                        const bx = b.x + Math.cos(b.angle * Math.PI / 180) * dist
                        const by = b.y + Math.sin(b.angle * Math.PI / 180) * dist

                        if (bx < 0 || bx > ARENA_WIDTH || by < 0 || by > ARENA_HEIGHT) return null

                        return (
                            <div
                                key={b.id}
                                className="absolute w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_5px_yellow]"
                                style={{
                                    left: (bx / ARENA_WIDTH) * 100 + '%',
                                    top: (by / ARENA_HEIGHT) * 100 + '%',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            />
                        )
                    })}
                </div>

                {/* Controls */}
                {localTank && localTank.health > 0 && isPlaying && (
                    <div className="grid grid-cols-3 gap-2 pb-4">
                        <div />
                        <motion.button whileTap={{ scale: 0.95 }} onPointerDown={() => handleAction('up')} className="w-16 h-16 bg-gray-700 rounded-lg text-2xl">⬆️</motion.button>
                        <div />
                        <motion.button whileTap={{ scale: 0.95 }} onPointerDown={() => handleAction('left')} className="w-16 h-16 bg-gray-700 rounded-lg text-2xl">⬅️</motion.button>
                        <motion.button whileTap={{ scale: 0.95 }} onPointerDown={() => handleAction('shoot')} className="w-16 h-16 bg-red-600 rounded-lg text-2xl border-b-4 border-red-800">🔥</motion.button>
                        <motion.button whileTap={{ scale: 0.95 }} onPointerDown={() => handleAction('right')} className="w-16 h-16 bg-gray-700 rounded-lg text-2xl">➡️</motion.button>
                        <div />
                        <motion.button whileTap={{ scale: 0.95 }} onPointerDown={() => handleAction('down')} className="w-16 h-16 bg-gray-700 rounded-lg text-2xl">⬇️</motion.button>
                        <div />
                    </div>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default TankBattle
