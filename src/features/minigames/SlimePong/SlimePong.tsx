/**
 * SlimePong - Classic Pong with slimes!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import { playWinFanfare } from '../HighNoon/sounds'

const ARENA_WIDTH = 300
const ARENA_HEIGHT = 200
const PADDLE_HEIGHT = 50
const PADDLE_WIDTH = 10
const BALL_SIZE = 10
const BALL_SPEED = 120 // Pixels per second
const WIN_SCORE = 5

interface PongState {
    ball: { x: number, y: number, vx: number, vy: number, lastUpdate: number }
    paddles: number[] // [y1, y2]
    scores: number[] // [s1, s2]
}

const SlimePong = () => {
    const engine = useMinigameEngine<PongState>({
        config: {
            countdownDuration: 3,
            gameDuration: 120 // 2 minutes max?
        },
        initialGameState: {
            ball: { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: BALL_SPEED, vy: BALL_SPEED * 0.5, lastUpdate: Date.now() },
            paddles: [ARENA_HEIGHT / 2, ARENA_HEIGHT / 2],
            scores: [0, 0]
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
        endGame
    } = engine

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const myIndex = players.findIndex(p => p.id === currentPlayerId)

    // Internal generic timestamp for delta calculations
    // We use Date.now() but relative to game? 
    // Just use standard Date.now() for local loops.
    // Leader writes Date.now() to state. Clients read it. 
    // If clocks differ, position shifts. 
    // Better: use `performance.now()` relative to mount? No, not synced.
    // We'll stick to Date.now() for simplicity and assume roughly synced clocks (<1s).

    const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [localBall, setLocalBall] = useState({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 })

    // Leader Physics Loop
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId || players.length < 2) return

        gameLoopRef.current = setInterval(() => {
            updateGameState(state => {
                const now = Date.now()
                const dt = (now - state.ball.lastUpdate) / 1000
                if (dt <= 0) return state

                let { x, y, vx, vy } = state.ball

                // Move
                x += vx * dt
                y += vy * dt

                let newVx = vx
                let newVy = vy
                let scored = false
                const newScores = [...state.scores]

                // Wall Collisions (Top/Bottom)
                if (y <= 0) { y = 0; newVy = Math.abs(vy) }
                else if (y >= ARENA_HEIGHT) { y = ARENA_HEIGHT; newVy = -Math.abs(vy) }

                // Paddle Collisions
                // Left Paddle
                if (x <= PADDLE_WIDTH + 5) {
                    const paddleY = state.paddles[0]
                    if (y >= paddleY - PADDLE_HEIGHT / 2 - 5 && y <= paddleY + PADDLE_HEIGHT / 2 + 5) {
                        newVx = Math.abs(vx)
                        x = PADDLE_WIDTH + 6
                    } else if (x < 0) {
                        // Score for P2
                        newScores[1]++
                        scored = true
                    }
                }
                // Right Paddle
                if (x >= ARENA_WIDTH - PADDLE_WIDTH - 5) {
                    const paddleY = state.paddles[1]
                    if (y >= paddleY - PADDLE_HEIGHT / 2 - 5 && y <= paddleY + PADDLE_HEIGHT / 2 + 5) {
                        newVx = -Math.abs(vx)
                        x = ARENA_WIDTH - PADDLE_WIDTH - 6
                    } else if (x > ARENA_WIDTH) {
                        // Score for P1
                        newScores[0]++
                        scored = true
                    }
                }

                if (scored) {
                    // Reset Ball
                    x = ARENA_WIDTH / 2
                    y = ARENA_HEIGHT / 2
                    newVx = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED
                    newVy = (Math.random() - 0.5) * BALL_SPEED
                }

                // Check Win
                if (newScores.some(s => s >= WIN_SCORE)) {
                    // Will be handled by effect
                }

                return {
                    ...state,
                    ball: {
                        x, y, vx: newVx, vy: newVy, lastUpdate: now
                    },
                    scores: newScores
                }
            })
        }, 50) // 20 FPS Physics Update

        return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current) }
    }, [isPlaying, isLeader, players.length, updateGameState, winnerId])


    // Client-side smoothing / prediction
    useEffect(() => {
        if (!isPlaying) return

        let animationFrame: number
        const animate = () => {
            const now = Date.now()
            const timeSinceUpdate = (now - gameState.ball.lastUpdate) / 1000

            // Extrapolate current position from last server state
            // This assumes constant velocity (no bounce processing locally for simplicity, 
            // the server update will correct it)
            // For smoother bounces, we could duplicate physics logic here.

            let ex = gameState.ball.x + gameState.ball.vx * timeSinceUpdate
            let ey = gameState.ball.y + gameState.ball.vy * timeSinceUpdate

            // Simple client-side clamp to keep it inside visual bounds roughly
            if (ey < 0) ey = 0
            if (ey > ARENA_HEIGHT) ey = ARENA_HEIGHT

            setLocalBall({ x: ex, y: ey })
            animationFrame = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animationFrame)
    }, [gameState.ball, isPlaying])


    // Win Condition Check
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return

        if (gameState.scores[0] >= WIN_SCORE) {
            playWinFanfare()
            endGame(players[0]?.id)
        } else if (gameState.scores[1] >= WIN_SCORE) {
            playWinFanfare()
            endGame(players[1]?.id)
        }
    }, [gameState.scores, isPlaying, isLeader, winnerId, players, endGame])


    // Input Handling
    const handleMove = useCallback((direction: 'up' | 'down') => {
        if (!isPlaying || myIndex === -1) return

        updateGameState(state => {
            const newPaddles = [...state.paddles]
            const currentY = newPaddles[myIndex]
            const newY = direction === 'up'
                ? Math.max(PADDLE_HEIGHT / 2, currentY - 20)
                : Math.min(ARENA_HEIGHT - PADDLE_HEIGHT / 2, currentY + 20)

            newPaddles[myIndex] = newY
            return { ...state, paddles: newPaddles }
        })
    }, [isPlaying, myIndex, updateGameState])

    const scale = 1.0

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-gray-900 to-black"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🏓 SLIME PONG!
                    </h1>
                    {isPlaying && (
                        <div className="text-4xl text-yellow-400 font-pixel mt-2">
                            {gameState.scores[0]} - {gameState.scores[1]}
                        </div>
                    )}
                </div>

                {isPlaying && players.length >= 2 && (
                    <div
                        className="relative bg-green-900 border-4 border-green-700 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,255,0,0.2)]"
                        style={{ width: ARENA_WIDTH * scale, height: ARENA_HEIGHT * scale }}
                    >
                        {/* Center Line */}
                        <div className="absolute left-1/2 top-0 h-full w-0.5 border-l-2 border-dashed border-white/20" />

                        {/* Paddles */}
                        <motion.div
                            className="absolute left-1 bg-red-500 rounded shadow-[0_0_10px_red]"
                            animate={{ top: gameState.paddles[0] - PADDLE_HEIGHT / 2 }}
                            style={{ width: PADDLE_WIDTH, height: PADDLE_HEIGHT }}
                        />
                        <motion.div
                            className="absolute right-1 bg-blue-500 rounded shadow-[0_0_10px_blue]"
                            animate={{ top: gameState.paddles[1] - PADDLE_HEIGHT / 2 }}
                            style={{ width: PADDLE_WIDTH, height: PADDLE_HEIGHT }}
                        />

                        {/* Ball */}
                        <div
                            className="absolute bg-white rounded-full shadow-[0_0_15px_white]"
                            style={{
                                left: localBall.x - BALL_SIZE / 2,
                                top: localBall.y - BALL_SIZE / 2,
                                width: BALL_SIZE,
                                height: BALL_SIZE
                            }}
                        />

                        {/* Names */}
                        <div className="absolute top-2 left-2 text-xs text-red-400 font-pixel">{players[0]?.username}</div>
                        <div className="absolute top-2 right-2 text-xs text-blue-400 font-pixel text-right">{players[1]?.username}</div>
                    </div>
                )}

                {players.length < 2 && (
                    <div className="text-white text-xl">Need 2 players to play Pong!</div>
                )}

                {/* Controls */}
                {isPlaying && myIndex !== -1 && (
                    <div className="flex gap-8 pb-8">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onPointerDown={() => handleMove('up')}
                            className="w-24 h-24 bg-gray-700 rounded-xl text-4xl shadow-lg border-b-4 border-gray-900 flex items-center justify-center"
                        >
                            ⬆️
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onPointerDown={() => handleMove('down')}
                            className="w-24 h-24 bg-gray-700 rounded-xl text-4xl shadow-lg border-b-4 border-gray-900 flex items-center justify-center"
                        >
                            ⬇️
                        </motion.button>
                    </div>
                )}

            </div>
        </MinigameWrapper>
    )
}

export default SlimePong
