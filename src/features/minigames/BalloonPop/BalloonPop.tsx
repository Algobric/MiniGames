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
const POP_THRESHOLD = 95

interface BalloonSize {
    playerId: string
    size: number
}

interface BalloonPopState {
    balloonSizes: BalloonSize[]
    popped: string[]   // Changed from Set to array
    locked: string[]   // Changed from Set to array
}

// Helper functions
const getBalloonSize = (sizes: BalloonSize[], playerId: string) =>
    sizes.find(s => s.playerId === playerId)?.size || 20

const hasPopped = (popped: string[], playerId: string) =>
    popped.includes(playerId)

const isLocked = (locked: string[], playerId: string) =>
    locked.includes(playerId)

const BalloonPop = () => {
    const engine = useMinigameEngine<BalloonPopState>({
        config: {
            countdownDuration: 3,
            gameDuration: 10
        },
        initialGameState: {
            balloonSizes: [],
            popped: [],
            locked: []
        },
        gameReducer: (state, event) => {
            const balloonSizes = Array.isArray(state.balloonSizes) ? state.balloonSizes : []
            const popped = Array.isArray(state.popped) ? state.popped : []
            const locked = Array.isArray(state.locked) ? state.locked : []

            if (event.type === 'BALLOON_PUMP') {
                const { playerId, newSize, didPop } = event as any

                if (didPop) {
                    return { ...state, popped: [...popped, playerId] }
                }

                const existingIdx = balloonSizes.findIndex(s => s.playerId === playerId)
                let newSizes: BalloonSize[]
                if (existingIdx >= 0) {
                    newSizes = [...balloonSizes]
                    newSizes[existingIdx] = { playerId, size: newSize }
                } else {
                    newSizes = [...balloonSizes, { playerId, size: newSize }]
                }
                return { ...state, balloonSizes: newSizes }
            }

            if (event.type === 'BALLOON_LOCK') {
                const { playerId } = event as any
                if (locked.includes(playerId)) return state
                return { ...state, locked: [...locked, playerId] }
            }

            return state
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
        dispatchGameEvent,
        endGame
    } = engine

    // Safe access to state arrays
    const balloonSizes = Array.isArray(gameState.balloonSizes) ? gameState.balloonSizes : []
    const popped = Array.isArray(gameState.popped) ? gameState.popped : []
    const locked = Array.isArray(gameState.locked) ? gameState.locked : []

    const gameEndedRef = useRef(false)
    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const startSize = 20

    // Initialize state
    useEffect(() => {
        if (players.length > 0 && balloonSizes.length === 0 && isPlaying) {
            updateGameState(state => ({
                ...state,
                balloonSizes: players.map(p => ({ playerId: p.id, size: startSize })),
                popped: [],
                locked: []
            }))
        }
    }, [players, balloonSizes.length, isPlaying, updateGameState])

    // Handle Time Out
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId || gameEndedRef.current) return

        if (timeRemaining !== null && timeRemaining <= 0) {
            gameEndedRef.current = true

            const activePlayers = players.filter(p => !hasPopped(popped, p.id))
            let bestId: string | null = null
            let maxSize = -1

            for (const p of activePlayers) {
                const size = getBalloonSize(balloonSizes, p.id)
                if (size > maxSize) {
                    maxSize = size
                    bestId = p.id
                }
            }

            if (bestId === currentPlayerId) playWinFanfare()
            endGame(bestId)
        }
    }, [timeRemaining, isPlaying, isLeader, winnerId, popped, balloonSizes, players, currentPlayerId, endGame])

    const handlePump = useCallback(() => {
        if (!isPlaying || !currentPlayerId) return
        if (hasPopped(popped, currentPlayerId) || isLocked(locked, currentPlayerId)) return

        const currentSize = getBalloonSize(balloonSizes, currentPlayerId)
        const newSize = Math.min(MAX_SIZE, currentSize + 3)
        playTap()

        // Risk calculation
        let didPop = false
        if (newSize > POP_THRESHOLD) {
            const popChance = (newSize - POP_THRESHOLD) / (MAX_SIZE - POP_THRESHOLD) * 0.3
            if (Math.random() < popChance) {
                playFail()
                didPop = true
            }
        }

        dispatchGameEvent('BALLOON_PUMP', { playerId: currentPlayerId, newSize, didPop })
    }, [isPlaying, currentPlayerId, popped, locked, balloonSizes, dispatchGameEvent])

    const handleLock = useCallback(() => {
        if (!isPlaying || !currentPlayerId) return
        if (hasPopped(popped, currentPlayerId) || isLocked(locked, currentPlayerId)) return

        dispatchGameEvent('BALLOON_LOCK', { playerId: currentPlayerId })
    }, [isPlaying, currentPlayerId, popped, locked, dispatchGameEvent])

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
                        const size = getBalloonSize(balloonSizes, player.id)
                        const playerPopped = hasPopped(popped, player.id)
                        const playerLocked = isLocked(locked, player.id)
                        const isWinner = player.id === winnerId

                        return (
                            <div key={player.id} className="text-center">
                                <div className="text-sm text-white mb-2">{player.username}</div>
                                <motion.div
                                    animate={{
                                        scale: playerPopped ? 0 : 1,
                                        opacity: playerPopped ? 0 : 1
                                    }}
                                    className="relative flex items-center justify-center"
                                    style={{ width: 150, height: 180 }}
                                >
                                    {!playerPopped && (
                                        <>
                                            <div
                                                className={clsx("rounded-full mx-auto transition-all duration-200", playerLocked && "ring-4 ring-green-400")}
                                                style={{
                                                    width: size * 1.5,
                                                    height: size * 1.8,
                                                    background: `radial-gradient(circle at 30% 30%, ${COLORS[idx % COLORS.length]}, ${COLORS[idx % COLORS.length]}88)`,
                                                    boxShadow: size > POP_THRESHOLD ? '0 0 20px #FF0000' : 'none'
                                                }}
                                            />
                                            <div className="absolute top-[85%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-transparent border-t-gray-600"
                                                style={{ transform: `translate(-50%, ${size * 0.9}px)` }}
                                            />
                                        </>
                                    )}
                                    {playerPopped && <div className="text-4xl">💥</div>}
                                    {isWinner && <div className="absolute -top-10 text-4xl">👑</div>}
                                </motion.div>
                                <div className="text-xs text-white/70 mt-2 font-pixel">
                                    {playerPopped ? 'POPPED!' : playerLocked ? 'LOCKED' : `${Math.round(size)}%`}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {isPlaying && currentPlayerId && !hasPopped(popped, currentPlayerId) && !isLocked(locked, currentPlayerId) && (
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

