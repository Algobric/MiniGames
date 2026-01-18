import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playCountdownBeep, playWinFanfare, playTap, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'DRAWING' | 'ENDED'

const DRAW_TIME = 10000 // 10 seconds to draw

const DrawCircle: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(DRAW_TIME)
    const [points, setPoints] = useState<{ x: number; y: number }[]>([])
    const [isDrawing, setIsDrawing] = useState(false)
    const [bestScore, setBestScore] = useState(0) // Track best circle this session
    const [allScores, setAllScores] = useState<Map<string, number>>(new Map())
    const [winner, setWinner] = useState<string | null>(null)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const isHostRef = useRef(isHost)
    isHostRef.current = isHost

    // Reset canvas on mount
    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        setBestScore(0)
    }, [])

    useEffect(() => {
        const handleInteraction = () => { unlockAudio(); window.removeEventListener('pointerdown', handleInteraction) }
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
                    setPhase('DRAWING')
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [phase])

    // Drawing timer
    useEffect(() => {
        if (phase !== 'DRAWING') return

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 100) {
                    clearInterval(interval)
                    // Time's up! Submit final score
                    if (currentPlayer) {
                        broadcastAndApply({
                            type: 'CIRCLE_SUBMIT',
                            playerId: currentPlayer.id,
                            score: bestScore
                        })
                    }
                    return 0
                }
                return prev - 100
            })
        }, 100)

        return () => clearInterval(interval)
    }, [phase, currentPlayer, bestScore, broadcastAndApply])

    // Draw on canvas
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || points.length < 2) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = '#4ECDC4'
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.stroke()
    }, [points])

    const calculateCircleScore = useCallback((pts: { x: number; y: number }[]): number => {
        if (pts.length < 10) return 0

        // Find center of mass
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length

        // Calculate average radius
        const distances = pts.map(p => Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2))
        const avgRadius = distances.reduce((sum, d) => sum + d, 0) / distances.length

        // Too small circles don't count well
        if (avgRadius < 30) return Math.max(0, Math.round(avgRadius))

        // Calculate variance (lower is better)
        const variance = distances.reduce((sum, d) => sum + (d - avgRadius) ** 2, 0) / distances.length
        const stdDev = Math.sqrt(variance)

        // Score: 100 - (deviation as percentage of radius)
        const deviationPercent = (stdDev / avgRadius) * 100
        const score = Math.max(0, Math.min(100, Math.round(100 - deviationPercent * 2)))

        return score
    }, [])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'CIRCLE_SUBMIT') {
            setAllScores(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.score)

                // Check if all submitted (everyone's time ran out)
                if (next.size >= players.length && isHostRef.current) {
                    setTimeout(() => {
                        let winnerId = players[0]?.id
                        let maxScore = -1
                        next.forEach((score, playerId) => {
                            if (score > maxScore) { maxScore = score; winnerId = playerId }
                        })

                        broadcastAndApply({ type: 'CIRCLE_GAME_OVER', winnerId, scores: Object.fromEntries(next) })
                    }, 500)
                }
                return next
            })
        }

        if (lastBroadcast.type === 'CIRCLE_GAME_OVER') {
            setPhase('ENDED')
            setWinner(lastBroadcast.winnerId)
            setAllScores(new Map(Object.entries(lastBroadcast.scores)))
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHostRef.current) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, players, currentPlayer?.id, onGameEnd, broadcastAndApply])

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (phase !== 'DRAWING' || timeLeft <= 0) return
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return

        setIsDrawing(true)
        setPoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }])
    }, [phase, timeLeft])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return

        setPoints(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }])
    }, [isDrawing])

    const handlePointerUp = useCallback(() => {
        if (!isDrawing || !currentPlayer) return
        setIsDrawing(false)

        // Calculate score for this attempt
        const score = calculateCircleScore(points)

        // Keep the best score
        if (score > bestScore) {
            setBestScore(score)
            playTap()
        }

        // Clear canvas for next attempt
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
                // Brief delay to show the circle before clearing
                setTimeout(() => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                    setPoints([])
                }, 300)
            }
        }
    }, [isDrawing, currentPlayer, points, calculateCircleScore, bestScore])

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-cyan-800 to-cyan-950 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>⭕ DIBUJA EL CÍRCULO!</h1>
                {phase === 'DRAWING' && (
                    <div className="text-xl text-yellow-400">{(timeLeft / 1000).toFixed(1)}s</div>
                )}
                <p className="text-lg text-cyan-300">¡Dibuja el círculo más perfecto!</p>
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase === 'DRAWING' && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    {/* Best score display */}
                    <div className="mb-2 text-center">
                        <span className="text-white/70">Tu mejor círculo: </span>
                        <span className={clsx(
                            "text-2xl font-pixel",
                            bestScore >= 80 ? "text-green-400" :
                                bestScore >= 50 ? "text-yellow-400" : "text-red-400"
                        )}>{bestScore}%</span>
                    </div>

                    <canvas
                        ref={canvasRef}
                        width={300}
                        height={300}
                        className="bg-white/10 rounded-lg border-2 border-cyan-400 touch-none"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    />

                    <p className="mt-4 text-white/70">¡Dibuja varios! Se guarda el mejor</p>
                </div>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">⭕</div>
                        <div className="text-4xl font-pixel text-cyan-400 mb-4">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                        <div className="space-y-2">
                            {players.map(player => (
                                <div key={player.id} className={clsx("text-xl", player.id === winner && "text-yellow-400")}>
                                    {player.username}: {allScores.get(player.id)}%
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default DrawCircle
