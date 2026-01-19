/**
 * OneClickGolf - Timing and precision!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, unlockAudio } from '../HighNoon/sounds'

const HOLE_X = 280
const HOLE_Y = 150
const HOLE_RADIUS = 15

type Phase = 'AIMING' | 'POWER' | 'FLYING'

interface ShotResult {
    distance: number
    isHoleInOne: boolean
}

interface OneClickGolfState {
    turnIndex: number
    results: Map<string, ShotResult> // playerId -> result
    currentPhase: Phase
    shotData: { angle: number, power: number, playerId: string } | null
}

const OneClickGolf = () => {
    const engine = useMinigameEngine<OneClickGolfState>({
        config: {
            countdownDuration: 3,
            gameDuration: 120 // Long max duration, game driven by turns
        },
        initialGameState: {
            turnIndex: 0,
            results: new Map(),
            currentPhase: 'AIMING',
            shotData: null
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
    const turnPlayerId = players[gameState.turnIndex]?.id
    const isMyTurn = isPlaying && turnPlayerId === currentPlayerId

    // Local visual state for oscillation
    const [angle, setAngle] = useState(0)
    const [power, setPower] = useState(0)
    const [ballPos, setBallPos] = useState({ x: 50, y: 180 })

    // Angle Oscillation
    useEffect(() => {
        if (gameState.currentPhase !== 'AIMING' || !isMyTurn) return
        const interval = setInterval(() => {
            setAngle(prev => {
                const newAngle = prev + 3
                return newAngle > 180 ? 0 : newAngle
            })
        }, 30)
        return () => clearInterval(interval)
    }, [gameState.currentPhase, isMyTurn])

    // Power Oscillation
    useEffect(() => {
        if (gameState.currentPhase !== 'POWER' || !isMyTurn) return
        const interval = setInterval(() => {
            setPower(prev => {
                const newPower = prev + 4
                return newPower > 100 ? 0 : newPower
            })
        }, 30)
        return () => clearInterval(interval)
    }, [gameState.currentPhase, isMyTurn])

    // Handle Shot Logic (When shotData changes in state)
    useEffect(() => {
        if (gameState.shotData) {
            const { angle, power, playerId } = gameState.shotData

            // Simulate Flight
            const rad = (angle * Math.PI) / 180
            const distance = power * 2.5
            const endX = 50 + Math.cos(rad) * distance
            const endY = 180 - Math.sin(rad) * distance

            // Animate (Visual)
            // We can set ball pos directly for simple "jump" or use animation library.
            // Using React state for simplicity.
            setBallPos({ x: endX, y: endY })

            // Wait for flight then Next Turn
            if (isLeader && gameState.currentPhase === 'FLYING') {
                const distToHole = Math.sqrt((endX - HOLE_X) ** 2 + (endY - HOLE_Y) ** 2)
                const isHoleInOne = distToHole <= HOLE_RADIUS

                setTimeout(() => {
                    // Record Result & Next Turn
                    const nextTurn = gameState.turnIndex + 1
                    const finished = nextTurn >= players.length

                    updateGameState(state => {
                        const newResults = new Map(state.results)
                        newResults.set(playerId, {
                            distance: isHoleInOne ? 0 : distToHole,
                            isHoleInOne
                        })

                        if (finished) {
                            // Find Winner
                            // Game ends via updateGameState side effect? No, trigger via useEffect.
                            return {
                                ...state,
                                results: newResults,
                                currentPhase: 'AIMING' // Reset phase for cleanliness 
                            }
                        } else {
                            // Reset for next player
                            return {
                                ...state,
                                turnIndex: nextTurn,
                                currentPhase: 'AIMING',
                                shotData: null
                            }
                        }
                    })
                }, 2000)
            }
        } else {
            // Reset ball position if new turn
            setBallPos({ x: 50, y: 180 })
            // Reset local power/angle?
            // They are reset by the oscillation effect start.
        }
    }, [gameState.shotData, isLeader, players.length, gameState.turnIndex, updateGameState])

    // Check Game Over
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId) return

        if (gameState.results.size === players.length && players.length > 0) {
            let bestId = players[0].id
            let minDist = Infinity

            gameState.results.forEach((res, pid) => {
                if (res.distance < minDist) {
                    minDist = res.distance
                    bestId = pid
                }
            })

            if (bestId === currentPlayerId) playWinFanfare()
            endGame(bestId)
        }
    }, [gameState.results, players, isPlaying, isLeader, winnerId, currentPlayerId, endGame])


    const handleClick = useCallback(() => {
        if (!isMyTurn) return

        playTap()
        if (gameState.currentPhase === 'AIMING') {
            updateGameState(state => ({ ...state, currentPhase: 'POWER' }))
        } else if (gameState.currentPhase === 'POWER') {
            // Commit Shot
            // We need to send our LOCAL angle/power to state
            updateGameState(state => ({
                ...state,
                currentPhase: 'FLYING',
                shotData: { angle, power, playerId: currentPlayerId! }
            }))
        }
    }, [isMyTurn, gameState.currentPhase, angle, power, currentPlayerId, updateGameState])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-green-500 to-green-700"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        ⛳ ONE CLICK GOLF!
                    </h1>
                    {isPlaying && (
                        <div className="text-lg text-yellow-300">
                            Turn: {players[gameState.turnIndex]?.username}
                            {isMyTurn && " (YOU)"}
                        </div>
                    )}
                </div>

                {isPlaying && (
                    <div className="relative w-80 h-48 bg-green-600 rounded-lg border-4 border-green-800 overflow-hidden shadow-2xl">
                        {/* Hole */}
                        <div
                            className="absolute rounded-full bg-black border-2 border-white"
                            style={{
                                left: HOLE_X - HOLE_RADIUS,
                                top: HOLE_Y - HOLE_RADIUS,
                                width: HOLE_RADIUS * 2,
                                height: HOLE_RADIUS * 2
                            }}
                        >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-2xl">🚩</div>
                        </div>

                        {/* Ball */}
                        <motion.div
                            animate={{ left: ballPos.x - 5, top: ballPos.y - 5 }}
                            transition={{ type: 'spring', damping: 10 }}
                            className="absolute w-3 h-3 bg-white rounded-full shadow-lg"
                        />

                        {/* Arrow */}
                        {gameState.currentPhase === 'AIMING' && isMyTurn && (
                            <motion.div
                                animate={{ rotate: -angle }}
                                className="absolute origin-left"
                                style={{ left: ballPos.x, top: ballPos.y, transform: `rotate(${-angle}deg)` }}
                            >
                                <div className="w-20 h-1 bg-red-500" />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-8 border-l-red-500 border-y-4 border-y-transparent" />
                            </motion.div>
                        )}
                    </div>
                )}

                {/* HUD */}
                <div className="w-full flex flex-col items-center gap-4 h-32">
                    {gameState.currentPhase === 'POWER' && isMyTurn && (
                        <div className="w-64 h-8 bg-gray-800 rounded-full overflow-hidden border-2 border-white">
                            <motion.div
                                animate={{ width: `${power}%` }}
                                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                            />
                        </div>
                    )}

                    <div className="text-xl text-white font-pixel">
                        {isMyTurn ? (
                            gameState.currentPhase === 'AIMING' ? "CLICK TO AIM!" :
                                gameState.currentPhase === 'POWER' ? "CLICK FOR POWER!" :
                                    "WATCH IT GO!"
                        ) : (
                            isPlaying ? `WAITING FOR ${players[gameState.turnIndex]?.username}...` : ""
                        )}
                    </div>
                </div>

                {/* Controls */}
                {isMyTurn && (gameState.currentPhase === 'AIMING' || gameState.currentPhase === 'POWER') && (
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleClick}
                        className="px-12 py-6 text-2xl font-pixel bg-yellow-500 text-black rounded-xl shadow-lg border-b-8 border-yellow-700 active:border-b-0 active:translate-y-2 mb-8"
                    >
                        ⛳ SHOOT!
                    </motion.button>
                )}

                {/* Results Preview */}
                <div className="flex gap-4">
                    {players.map(p => {
                        const res = gameState.results.get(p.id)
                        return res ? (
                            <div key={p.id} className="text-xs text-white bg-black/30 px-2 py-1 rounded">
                                {p.username}: {res.isHoleInOne ? "HOLE IN ONE!" : res.distance.toFixed(1)}
                            </div>
                        ) : null
                    })}
                </div>

            </div>
        </MinigameWrapper>
    )
}

export default OneClickGolf
