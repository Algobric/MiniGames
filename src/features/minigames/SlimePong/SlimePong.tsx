import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import { playTap, playCountdownBeep, playWinFanfare, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

const ARENA_WIDTH = 300
const ARENA_HEIGHT = 200
const PADDLE_HEIGHT = 50
const PADDLE_WIDTH = 10
const BALL_SIZE = 10
const BALL_SPEED = 4
const WIN_SCORE = 5

const SlimePong: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [paddleY, setPaddleY] = useState<[number, number]>([ARENA_HEIGHT / 2, ARENA_HEIGHT / 2])
    const [ballPos, setBallPos] = useState({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 })
    const [ballVel, setBallVel] = useState({ x: BALL_SPEED, y: BALL_SPEED / 2 })
    const [scores, setScores] = useState<[number, number]>([0, 0])
    const [winner, setWinner] = useState<string | null>(null)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const myIndex = players.findIndex(p => p.id === currentPlayer?.id)
    const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

    // Game physics loop (host only)
    useEffect(() => {
        if (phase !== 'PLAYING' || !isHost) return

        gameLoopRef.current = setInterval(() => {
            setBallPos(prev => {
                let newX = prev.x + ballVel.x
                let newY = prev.y + ballVel.y
                let newVelX = ballVel.x
                let newVelY = ballVel.y

                // Top/bottom bounce
                if (newY <= 0 || newY >= ARENA_HEIGHT) {
                    newVelY = -newVelY
                    newY = Math.max(0, Math.min(ARENA_HEIGHT, newY))
                }

                // Left paddle collision
                if (newX <= PADDLE_WIDTH + 5) {
                    const paddleTop = paddleY[0] - PADDLE_HEIGHT / 2
                    const paddleBottom = paddleY[0] + PADDLE_HEIGHT / 2
                    if (newY >= paddleTop && newY <= paddleBottom) {
                        newVelX = Math.abs(newVelX)
                        newX = PADDLE_WIDTH + 5
                        playTap()
                    }
                }

                // Right paddle collision
                if (newX >= ARENA_WIDTH - PADDLE_WIDTH - 5) {
                    const paddleTop = paddleY[1] - PADDLE_HEIGHT / 2
                    const paddleBottom = paddleY[1] + PADDLE_HEIGHT / 2
                    if (newY >= paddleTop && newY <= paddleBottom) {
                        newVelX = -Math.abs(newVelX)
                        newX = ARENA_WIDTH - PADDLE_WIDTH - 5
                        playTap()
                    }
                }

                // Score
                if (newX <= 0 || newX >= ARENA_WIDTH) {
                    const scorer = newX <= 0 ? 1 : 0
                    const newScores: [number, number] = [...scores] as [number, number]
                    newScores[scorer]++

                    broadcastAndApply({
                        type: 'PONG_SCORE',
                        scores: newScores,
                        winnerId: newScores[scorer] >= WIN_SCORE ? players[scorer]?.id : null
                    })

                    // Reset ball
                    return { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 }
                }

                setBallVel({ x: newVelX, y: newVelY })
                broadcastAndApply({ type: 'PONG_BALL', x: newX, y: newY, vx: newVelX, vy: newVelY })
                return { x: newX, y: newY }
            })
        }, 30)

        return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current) }
    }, [phase, isHost, ballVel, paddleY, scores, players, broadcastAndApply])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'PONG_BALL') {
            setBallPos({ x: lastBroadcast.x, y: lastBroadcast.y })
            setBallVel({ x: lastBroadcast.vx, y: lastBroadcast.vy })
        }

        if (lastBroadcast.type === 'PONG_PADDLE') {
            setPaddleY(prev => {
                const next: [number, number] = [...prev] as [number, number]
                next[lastBroadcast.playerIndex] = lastBroadcast.y
                return next
            })
        }

        if (lastBroadcast.type === 'PONG_SCORE') {
            setScores(lastBroadcast.scores)
            if (lastBroadcast.winnerId) {
                setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
                if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
                if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
            }
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    const handleMove = useCallback((direction: 'up' | 'down') => {
        if (phase !== 'PLAYING' || myIndex < 0) return

        const currentY = paddleY[myIndex]
        const newY = direction === 'up'
            ? Math.max(PADDLE_HEIGHT / 2, currentY - 15)
            : Math.min(ARENA_HEIGHT - PADDLE_HEIGHT / 2, currentY + 15)

        setPaddleY(prev => {
            const next: [number, number] = [...prev] as [number, number]
            next[myIndex] = newY
            return next
        })

        broadcastAndApply({ type: 'PONG_PADDLE', playerIndex: myIndex, y: newY })
    }, [phase, myIndex, paddleY, broadcastAndApply])

    const scale = 1.2

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-gray-900 to-black select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🏓 SLIME PONG!</h1>
                <div className="text-2xl text-yellow-400 font-pixel">{scores[0]} - {scores[1]}</div>
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && (
                <div
                    className="relative bg-green-900 border-4 border-green-700 rounded-lg"
                    style={{ width: ARENA_WIDTH * scale, height: ARENA_HEIGHT * scale }}
                >
                    {/* Center line */}
                    <div className="absolute left-1/2 top-0 h-full w-1 border-l-2 border-dashed border-white/30" />

                    {/* Left paddle */}
                    <motion.div
                        animate={{ top: paddleY[0] * scale - (PADDLE_HEIGHT * scale) / 2 }}
                        className="absolute left-1 rounded bg-red-500"
                        style={{ width: PADDLE_WIDTH * scale, height: PADDLE_HEIGHT * scale }}
                    />

                    {/* Right paddle */}
                    <motion.div
                        animate={{ top: paddleY[1] * scale - (PADDLE_HEIGHT * scale) / 2 }}
                        className="absolute right-1 rounded bg-blue-500"
                        style={{ width: PADDLE_WIDTH * scale, height: PADDLE_HEIGHT * scale }}
                    />

                    {/* Ball */}
                    <motion.div
                        animate={{ left: ballPos.x * scale - BALL_SIZE, top: ballPos.y * scale - BALL_SIZE }}
                        className="absolute bg-white rounded-full"
                        style={{ width: BALL_SIZE * 2, height: BALL_SIZE * 2, boxShadow: '0 0 10px white' }}
                    />

                    {/* Player labels */}
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-red-400">{players[0]?.username}</div>
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 rotate-90 text-xs text-blue-400">{players[1]?.username}</div>
                </div>
            )}

            {/* Controls */}
            {phase === 'PLAYING' && (
                <div className="flex gap-8 pb-4">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('up')}
                        className="w-20 h-20 bg-gray-700 rounded-xl text-3xl">⬆️</motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleMove('down')}
                        className="w-20 h-20 bg-gray-700 rounded-xl text-3xl">⬇️</motion.button>
                </div>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🏓</div>
                        <div className="text-4xl font-pixel text-green-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                        <div className="text-2xl text-white mt-2">{scores[0]} - {scores[1]}</div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default SlimePong
