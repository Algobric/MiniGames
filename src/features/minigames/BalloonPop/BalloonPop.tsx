/**
 * BalloonPop - Inflate without popping!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

const MAX_SIZE = 100
const POP_THRESHOLD = 95 // Above this, risk of popping

interface BalloonPopState {
    balloonSizes: Map<string, number>
    popped: Set<string>
    locked: Set<string>
}

const BalloonPop = () => {
    const engine = useMinigameEngine<BalloonPopState>({
        config: {
            countdownDuration: 3,
            gameDuration: 10 // 10 seconds
        },
        initialGameState: {
            balloonSizes: new Map(),
            popped: new Set(),
            locked: new Set()
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

    const gameEndedRef = useRef(false) // Local ref to prevent double triggers in effect
    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const startSize = 20

    // Initialize state
    useEffect(() => {
        if (players.length > 0 && gameState.balloonSizes.size === 0) {
            updateGameState(state => ({
                ...state,
                balloonSizes: new Map(players.map(p => [p.id, startSize])),
                popped: new Set(),
                locked: new Set()
            }))
        }
    }, [players, gameState.balloonSizes.size, updateGameState])

    // Handle Time Out
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId || gameEndedRef.current) return

        if (timeRemaining !== null && timeRemaining <= 0) {
            // Determine winner
            gameEndedRef.current = true

            const activePlayers = players.filter(p => !gameState.popped.has(p.id))
            let bestId: string | null = null
            let maxSize = -1

            for (const p of activePlayers) {
                const size = gameState.balloonSizes.get(p.id) || 0
                if (size > maxSize) {
                    maxSize = size
                    bestId = p.id
                }
            }

            if (bestId === currentPlayerId) playWinFanfare()
            endGame(bestId)
        }
    }, [timeRemaining, isPlaying, isLeader, winnerId, gameState.popped, gameState.balloonSizes, players, currentPlayerId, endGame])

    const handlePump = useCallback(() => {
        if (!isPlaying || !currentPlayerId) return
        if (gameState.popped.has(currentPlayerId) || gameState.locked.has(currentPlayerId)) return

        const currentSize = gameState.balloonSizes.get(currentPlayerId) || startSize
        const newSize = Math.min(MAX_SIZE, currentSize + 3)
        playTap()

        // Risk calculation: bigger balloon = higher chance of popping
        // Client-side authoritative pop check is fine here
        if (newSize > POP_THRESHOLD) {
            const popChance = (newSize - POP_THRESHOLD) / (MAX_SIZE - POP_THRESHOLD) * 0.3
            if (Math.random() < popChance) {
                playFail()
                updateGameState(state => ({
                    ...state,
                    popped: new Set([...state.popped, currentPlayerId])
                }))
                return
            }
        }

        updateGameState(state => ({
            ...state,
            balloonSizes: new Map([...state.balloonSizes, [currentPlayerId, newSize]])
        }))

    }, [isPlaying, currentPlayerId, gameState.popped, gameState.locked, gameState.balloonSizes, updateGameState])

    const handleLock = useCallback(() => {
        if (!isPlaying || !currentPlayerId) return
        if (gameState.popped.has(currentPlayerId) || gameState.locked.has(currentPlayerId)) return

        updateGameState(state => ({
            ...state,
            locked: new Set([...state.locked, currentPlayerId])
        }))
    }, [isPlaying, currentPlayerId, gameState.popped, gameState.locked, updateGameState])

    const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#DDA0DD', '#87CEEB']

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-sky-300 to-sky-500"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🎈 BALLOON POP!
                    </h1>
                </div>

                <div className="flex-1 flex items-center justify-center gap-8 flex-wrap content-center">
                    {players.map((player, idx) => {
                        const size = gameState.balloonSizes.get(player.id) || startSize
                        const hasPopped = gameState.popped.has(player.id)
                        const isLocked = gameState.locked.has(player.id)
                        const isWinner = player.id === winnerId

                        return (
                            <div key={player.id} className="text-center">
                                <div className="text-sm text-white mb-2">{player.username}</div>
                                <motion.div
                                    animate={{
                                        scale: hasPopped ? 0 : 1,
                                        opacity: hasPopped ? 0 : 1
                                    }}
                                    className="relative flex items-center justify-center"
                                    style={{ width: 150, height: 180 }} // Fixed container to avoid jumping
                                >
                                    {!hasPopped && (
                                        <>
                                            <div
                                                className={clsx("rounded-full mx-auto transition-all duration-200", isLocked && "ring-4 ring-green-400")}
                                                style={{
                                                    width: size * 1.5,
                                                    height: size * 1.8,
                                                    background: `radial-gradient(circle at 30% 30%, ${COLORS[idx % COLORS.length]}, ${COLORS[idx % COLORS.length]}88)`,
                                                    boxShadow: size > POP_THRESHOLD ? '0 0 20px #FF0000' : 'none'
                                                }}
                                            />
                                            {/* String of balloon */}
                                            <div className="absolute top-[85%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-gray-600"
                                                style={{ transform: `translate(-50%, ${size * 0.9}px)` }} // Move string with size? Actually keeping it simple for now
                                            />
                                        </>
                                    )}
                                    {hasPopped && <div className="text-4xl">💥</div>}
                                    {isWinner && <div className="absolute -top-10 text-4xl">👑</div>}
                                </motion.div>
                                <div className="text-xs text-white/70 mt-2 font-pixel">
                                    {hasPopped ? 'POPPED!' : isLocked ? 'LOCKED' : `${Math.round(size)}%`}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {isPlaying && currentPlayerId && !gameState.popped.has(currentPlayerId) && !gameState.locked.has(currentPlayerId) && (
                    <div className="flex gap-4 pb-4">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handlePump}
                            className="px-8 py-4 text-xl font-pixel bg-red-500 text-white rounded-xl shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
                        >
                            💨 PUMP
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleLock}
                            className="px-8 py-4 text-xl font-pixel bg-green-500 text-white rounded-xl shadow-lg border-b-4 border-green-700 active:border-b-0 active:translate-y-1"
                        >
                            🔒 HOLD
                        </motion.button>
                    </div>
                )}
            </div>
        </MinigameWrapper>
    )
}


export default BalloonPop
