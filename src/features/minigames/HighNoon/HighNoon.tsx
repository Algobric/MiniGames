/**
 * HighNoon - Cowboy Standoff Game
 * 
 * FIXED VERSION using the modular game engine.
 * - Fixed dark screen issue (was waiting forever)
 * - Fixed stuck STEADY (leader detection + SIGNAL dispatch)
 * - Fixed misfire freeze (ends game when all disqualified)
 */

import { useEffect, useRef, useCallback } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { playGunshot, playDrawSignal, playWinFanfare, playFail } from './sounds'

// ===== GAME STATE =====
interface HighNoonState {
    drawSignalTime: number | null
    shots: Map<string, number>
    misfires: Set<string>
    localPhase: 'WAIT' | 'DRAW' | 'RESOLVING'
}

// ===== THE COMPONENT =====
const HighNoon = () => {
    const engine = useMinigameEngine<HighNoonState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            drawSignalTime: null,
            shots: new Map(),
            misfires: new Set(),
            localPhase: 'WAIT'
        },
        gameReducer: (state, event) => {
            if (event.type === 'HIGHNOON_SHOOT') {
                const { timestamp } = event as any
                const newShots = new Map(state.shots)
                newShots.set(event.senderId, timestamp)
                return { ...state, shots: newShots }
            }
            if (event.type === 'HIGHNOON_MISFIRE') {
                const newMisfires = new Set(state.misfires)
                newMisfires.add(event.senderId)
                return { ...state, misfires: newMisfires }
            }
            if (event.type === 'HIGHNOON_SIGNAL') {
                const { timestamp } = event as any
                return { ...state, localPhase: 'DRAW', drawSignalTime: timestamp }
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
        dispatchGameEvent,
        endGame
    } = engine

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hasShotRef = useRef(false)
    const gameEndedRef = useRef(false)

    // Reset refs when game starts
    useEffect(() => {
        if (isPlaying) {
            hasShotRef.current = false
            gameEndedRef.current = false
        }
    }, [isPlaying])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    // Schedule DRAW signal when game starts (LEADER ONLY)
    useEffect(() => {
        // Calculate isLeader dynamically every render to avoid stale closure
        const isLeader = players.length > 0 && players[0].id === currentPlayerId

        if (!isPlaying || gameState.localPhase !== 'WAIT' || !isLeader || winnerId) return

        console.log('[HIGHNOON] Leader scheduling DRAW signal...')

        const delay = 2000 + Math.random() * 3000

        timerRef.current = setTimeout(() => {
            console.log('[HIGHNOON] Leader sending DRAW signal!')
            playDrawSignal()
            const now = Date.now()
            dispatchGameEvent('HIGHNOON_SIGNAL', { timestamp: now })
        }, delay)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [isPlaying, gameState.localPhase, currentPlayerId, players, winnerId, dispatchGameEvent])

    // Determine winner when someone shoots (LEADER ONLY)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId

        if (gameState.localPhase !== 'DRAW' || winnerId || gameEndedRef.current) return
        if (!isLeader) return

        // Check if we have any valid shots
        const validShots = Array.from(gameState.shots.entries())
            .filter(([playerId]) => !gameState.misfires.has(playerId))
            .sort(([, a], [, b]) => a - b)

        if (validShots.length > 0) {
            gameEndedRef.current = true
            const [fastestPlayerId, shotTime] = validShots[0]
            const reactionTime = gameState.drawSignalTime
                ? shotTime - gameState.drawSignalTime
                : 0

            console.log('[HIGHNOON] Winner determined:', fastestPlayerId, 'reaction:', reactionTime)
            playWinFanfare()
            endGame(fastestPlayerId, [
                { playerId: fastestPlayerId, score: 100, rank: 1, metadata: { reactionTime } }
            ])
        }
    }, [gameState.shots, gameState.localPhase, gameState.misfires, gameState.drawSignalTime, winnerId, endGame, players, currentPlayerId])

    // Check for game end when all players misfired
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId

        if (!isPlaying || winnerId || gameEndedRef.current) return
        if (!isLeader) return
        if (players.length === 0) return

        // Check if ALL players have misfired
        const allMisfired = players.every(p => gameState.misfires.has(p.id))

        if (allMisfired) {
            console.log('[HIGHNOON] All players misfired! No winner.')
            gameEndedRef.current = true
            playFail()
            endGame(null) // No winner
        }
    }, [gameState.misfires, players, winnerId, isPlaying, endGame, currentPlayerId])

    // Check for single remaining player after misfire (also ends game)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId

        if (!isPlaying || winnerId || gameEndedRef.current) return
        if (!isLeader) return
        if (players.length < 2) return

        // If only one player hasn't misfired, they win
        const validPlayers = players.filter(p => !gameState.misfires.has(p.id))

        if (validPlayers.length === 1 && gameState.misfires.size > 0) {
            console.log('[HIGHNOON] Only one player remaining:', validPlayers[0].id)
            gameEndedRef.current = true
            playWinFanfare()
            endGame(validPlayers[0].id, [
                { playerId: validPlayers[0].id, score: 100, rank: 1, metadata: { byDefault: true } }
            ])
        }
    }, [gameState.misfires, players, winnerId, isPlaying, endGame, currentPlayerId])

    const handleTap = useCallback(() => {
        if (!currentPlayerId || hasShotRef.current || winnerId) return
        if (gameState.misfires.has(currentPlayerId)) return

        hasShotRef.current = true
        const timestamp = Date.now()

        if (gameState.localPhase === 'WAIT') {
            // TOO EARLY - misfire!
            console.log('[HIGHNOON] Misfire!')
            playFail()
            dispatchGameEvent('HIGHNOON_MISFIRE', { playerId: currentPlayerId })
            return
        }

        if (gameState.localPhase === 'DRAW') {
            // Valid shot
            console.log('[HIGHNOON] Shot fired!')
            playGunshot()
            dispatchGameEvent('HIGHNOON_SHOOT', { playerId: currentPlayerId, timestamp })
        }
    }, [currentPlayerId, gameState.localPhase, gameState.misfires, winnerId, dispatchGameEvent])

    // Background color based on state
    const bgColor = gameState.localPhase === 'DRAW'
        ? 'bg-red-700'
        : gameState.misfires.has(currentPlayerId ?? '')
            ? 'bg-yellow-600'
            : 'bg-gradient-to-b from-amber-900 to-amber-800'

    const getMessage = () => {
        if (gameState.misfires.has(currentPlayerId ?? '')) return '💀 TOO EARLY!'
        if (gameState.localPhase === 'WAIT') return 'STEADY...'
        if (gameState.localPhase === 'DRAW') return '🔥 FIRE! 🔥'
        if (gameState.localPhase === 'RESOLVING') return '🏆 WINNER!'
        return ''
    }

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor={bgColor}
        >
            <div
                className="flex flex-col items-center justify-between w-full h-full p-4 cursor-pointer select-none"
                onPointerDown={handleTap}
            >
                {/* Title/Message */}
                <div className="pt-8 text-center z-10">
                    <motion.h1
                        key={getMessage()}
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-4xl md:text-7xl font-pixel text-white"
                        style={{ textShadow: '0 0 20px currentColor, 0 4px 0 #000' }}
                    >
                        {getMessage()}
                    </motion.h1>
                </div>

                {/* Game Area */}
                <div className="flex-1 w-full flex items-center justify-center relative">
                    {/* Ground */}
                    <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-amber-800 to-amber-700" />
                    {/* Sun */}
                    <div
                        className="absolute top-8 right-8 w-16 h-16 rounded-full bg-yellow-400 opacity-80"
                        style={{ boxShadow: '0 0 40px #FFD700' }}
                    />

                    {/* Players */}
                    <div className="relative w-full max-w-4xl h-64 flex items-end justify-between px-8 md:px-16">
                        {players.slice(0, 2).map((player, idx) => {
                            const hasMisfired = gameState.misfires.has(player.id)
                            const hasShot = gameState.shots.has(player.id)
                            const isMe = player.id === currentPlayerId

                            return (
                                <motion.div
                                    key={player.id}
                                    className="flex flex-col items-center"
                                    animate={{
                                        y: hasMisfired ? 20 : 0,
                                        rotate: hasMisfired ? (idx === 0 ? 45 : -45) : 0,
                                        opacity: hasMisfired ? 0.5 : 1
                                    }}
                                >
                                    <div className={clsx(
                                        "text-sm md:text-base font-pixel mb-2 px-2 py-1 rounded",
                                        isMe
                                            ? "bg-atari-green text-black"
                                            : "bg-black/50 text-white"
                                    )}>
                                        {player.username}
                                    </div>
                                    <div className="text-6xl md:text-8xl">
                                        {hasMisfired ? '💀' : hasShot ? '💥' : '🤠'}
                                    </div>
                                    {hasMisfired && (
                                        <div className="text-xs text-red-400 mt-1">DISQUALIFIED</div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>
                </div>

                {/* Instructions */}
                <div className="pb-8 text-center z-10">
                    <div className="text-lg md:text-xl font-mono text-white/90">
                        {gameState.misfires.has(currentPlayerId ?? '') ? (
                            <span className="text-yellow-300">DISQUALIFIED - TOO EARLY!</span>
                        ) : gameState.localPhase === 'WAIT' ? (
                            <span className="animate-pulse">WAIT FOR THE SIGNAL...</span>
                        ) : gameState.localPhase === 'DRAW' && !hasShotRef.current ? (
                            <motion.span
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 0.3 }}
                                className="text-red-300"
                            >
                                TAP NOW!
                            </motion.span>
                        ) : hasShotRef.current && !winnerId ? (
                            <span className="text-atari-cyan">SHOT FIRED! WAITING...</span>
                        ) : null}
                    </div>
                </div>

                {/* Flash effect on DRAW */}
                <AnimatePresence>
                    {gameState.localPhase === 'DRAW' && !hasShotRef.current && (
                        <motion.div
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.1 }}
                            className="absolute inset-0 bg-white pointer-events-none"
                        />
                    )}
                </AnimatePresence>
            </div>
        </MinigameWrapper>
    )
}

export default HighNoon
