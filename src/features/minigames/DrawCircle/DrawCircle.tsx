/**
 * DrawCircle - Draw the perfect circle!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

const DRAW_TIME = 10 // 10 seconds

interface DrawCircleState {
    submittedScores: Map<string, number>
}

const DrawCircle = () => {
    const engine = useMinigameEngine<DrawCircleState>({
        config: {
            countdownDuration: 3,
            gameDuration: DRAW_TIME
        },
        initialGameState: {
            submittedScores: new Map()
        }
    })

    const {
        phase,
        countdown,
        timeRemaining,
        gameState,
        winnerId,
        isPlaying,
        currentPlayerId,
        players,
        updateGameState,
        endGame
    } = engine

    const [points, setPoints] = useState<{ x: number; y: number }[]>([])
    const [isDrawing, setIsDrawing] = useState(false)
    const [bestScore, setBestScore] = useState(0)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const gameEndedRef = useRef(false)
    const isLeader = players.length > 0 && players[0].id === currentPlayerId

    // Game End Logic
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId || gameEndedRef.current) return

        const allSubmitted = gameState.submittedScores.size === players.length && players.length > 0
        const timeOut = timeRemaining !== null && timeRemaining <= 0

        if (allSubmitted || timeOut) {
            gameEndedRef.current = true

            // Wait a moment if it was all submitted to let animations finish, then end
            // If timeout, end immediately
            const delay = timeOut ? 0 : 1000

            setTimeout(() => {
                let bestId: string | null = null
                let maxScore = -1

                gameState.submittedScores.forEach((score, pid) => {
                    if (score > maxScore) {
                        maxScore = score
                        bestId = pid
                    }
                })

                // If I haven't submitted (e.g. timeout), check my local best score? 
                // Ideally, local score should be submitted automatically on timeout.
                // But Leader doesn't know my local score.
                // So clients MUST submit before timeout or ON timeout.

                if (bestId === currentPlayerId) playWinFanfare()

                const results = Array.from(gameState.submittedScores.entries()).map(([pid, score]) => ({
                    playerId: pid,
                    score: score,
                    rank: 0
                })).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }))

                endGame(bestId, results)
            }, delay)
        }
    }, [isPlaying, isLeader, winnerId, gameState.submittedScores, players.length, timeRemaining, currentPlayerId, endGame])

    // Auto-submit on timeout if not done
    useEffect(() => {
        if (!isPlaying || !currentPlayerId) return

        if (timeRemaining !== null && timeRemaining <= 0 && !gameState.submittedScores.has(currentPlayerId)) {
            // Submit whatever best score we have
            updateGameState(state => ({
                ...state,
                submittedScores: new Map([...state.submittedScores, [currentPlayerId, bestScore]])
            }))
        }
    }, [timeRemaining, isPlaying, currentPlayerId, gameState.submittedScores, bestScore, updateGameState])


    // Drawing & Scoring Logic
    const calculateCircleScore = useCallback((pts: { x: number; y: number }[]): number => {
        if (pts.length < 10) return 0
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length
        const distances = pts.map(p => Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2))
        const avgRadius = distances.reduce((sum, d) => sum + d, 0) / distances.length
        if (avgRadius < 30) return Math.max(0, Math.round(avgRadius))
        const variance = distances.reduce((sum, d) => sum + (d - avgRadius) ** 2, 0) / distances.length
        const stdDev = Math.sqrt(variance)
        const deviationPercent = (stdDev / avgRadius) * 100
        return Math.max(0, Math.min(100, Math.round(100 - deviationPercent * 2)))
    }, [])

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!isPlaying) return
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        setIsDrawing(true)
        setPoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }])
    }, [isPlaying])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDrawing) return
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        setPoints(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }])
    }, [isDrawing])

    const handlePointerUp = useCallback(() => {
        if (!isDrawing || !currentPlayerId) return
        setIsDrawing(false)

        const score = calculateCircleScore(points)
        if (score > bestScore) {
            setBestScore(score)
            playTap()
            // We optimize game state updates: only submit when time is low? 
            // Or allow re-submits?
            // "Best score this session" is kept locally. 
            // We should submit the BEST score when done.
            // Let's assume we submit on Time Out, OR if user clicks "Submit"?
            // Existing logic: "Submit" button? No, just keep drawing.
            // Game ends on timeout.
            // So we just update local state `bestScore`.
            // AND we update global state occasionally? 
            // Actually, to show live leaderboards, we could update global state on every better score.
            updateGameState(state => ({
                ...state,
                submittedScores: new Map([...state.submittedScores, [currentPlayerId, score]])
            }))
        }

        // Clear canvas logic (visual only)
        const canvas = canvasRef.current
        if (canvas) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
                setTimeout(() => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                    setPoints([])
                }, 300)
            }
        }
    }, [isDrawing, currentPlayerId, points, calculateCircleScore, bestScore, updateGameState])

    // Render Canvas
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

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-cyan-800 to-cyan-950"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        ⭕ DRAW CIRCLE!
                    </h1>
                </div>

                {isPlaying && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="mb-2 text-center">
                            <span className="text-white/70">Your Best: </span>
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
                            className="bg-white/10 rounded-lg border-2 border-cyan-400 touch-none shadow-2xl"
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                        />
                        <p className="mt-4 text-white/50 text-sm">Draw a perfect circle inside the box</p>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 justify-center pb-4">
                    {players.map(player => (
                        <div key={player.id} className={clsx(
                            "px-3 py-1 rounded bg-black/30 border border-white/10 text-sm",
                            player.id === winnerId && "border-yellow-400 text-yellow-400"
                        )}>
                            {player.username}: {gameState.submittedScores.get(player.id) || 0}%
                        </div>
                    ))}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default DrawCircle
