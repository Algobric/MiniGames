/**
 * HighNoon - Cowboy Standoff Game
 * 
 * FIXED VERSION using the modular game engine.
 * - Uses arrays instead of Map/Set for sync compatibility
 * - Fixed dark screen, stuck STEADY, and misfire freeze
 */

import { useEffect, useRef, useCallback } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { playGunshot, playDrawSignal, playWinFanfare, playFail } from './sounds'

// ===== GAME STATE (using arrays for sync compatibility) =====
interface Shot {
    playerId: string
    timestamp: number
}

interface HighNoonState {
    drawSignalTime: number | null
    shots: Shot[]  // Array instead of Map
    misfires: string[]  // Array instead of Set
    localPhase: 'WAIT' | 'DRAW' | 'RESOLVING'
}

// Helper functions
const hasMisfired = (misfires: string[], playerId: string) => misfires.includes(playerId)
const hasShot = (shots: Shot[], playerId: string) => shots.some(s => s.playerId === playerId)

// ===== THE COMPONENT =====
const HighNoon = () => {
    const engine = useMinigameEngine<HighNoonState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            drawSignalTime: null,
            shots: [],
            misfires: [],
            localPhase: 'WAIT'
        },
        gameReducer: (state, event) => {
            // Ensure arrays exist (in case of sync issues)
            const shots = Array.isArray(state.shots) ? state.shots : []
            const misfires = Array.isArray(state.misfires) ? state.misfires : []

            if (event.type === 'HIGHNOON_SHOOT') {
                const { timestamp } = event as any
                // Only add if not already shot
                if (hasShot(shots, event.senderId)) return state
                return {
                    ...state,
                    shots: [...shots, { playerId: event.senderId, timestamp }]
                }
            }
            if (event.type === 'HIGHNOON_MISFIRE') {
                // Only add if not already misfired
                if (hasMisfired(misfires, event.senderId)) return state
                return {
                    ...state,
                    misfires: [...misfires, event.senderId]
                }
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

    // Ensure arrays exist for safety
    const shots = Array.isArray(gameState.shots) ? gameState.shots : []
    const misfires = Array.isArray(gameState.misfires) ? gameState.misfires : []

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hasShotRef = useRef(false)
    const gameEndedRef = useRef(false)
    const signalScheduledRef = useRef(false)

    // Reset refs when game starts
    useEffect(() => {
        if (isPlaying) {
            hasShotRef.current = false
            gameEndedRef.current = false
            signalScheduledRef.current = false
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
        // Already scheduled? Skip
        if (signalScheduledRef.current) return

        const isLeader = players.length > 0 && players[0].id === currentPlayerId

        if (!isPlaying || gameState.localPhase !== 'WAIT' || !isLeader || winnerId) return

        // Mark as scheduled BEFORE setting timeout
        signalScheduledRef.current = true

        console.log('[HIGHNOON] Leader scheduling DRAW signal...')

        // Random delay between 6-12 seconds
        const delay = 6000 + Math.random() * 6000

        timerRef.current = setTimeout(() => {
            console.log('[HIGHNOON] Leader sending DRAW signal!')
            playDrawSignal()
            const now = Date.now()
            dispatchGameEvent('HIGHNOON_SIGNAL', { timestamp: now })
        }, delay)

        // NO CLEANUP HERE - the unmount effect handles cleanup
        // Cleanup here would cancel the timer when deps change!
    }, [isPlaying, gameState.localPhase, currentPlayerId, players, winnerId, dispatchGameEvent])

    // Determine winner when someone shoots (LEADER ONLY)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId

        if (gameState.localPhase !== 'DRAW' || winnerId || gameEndedRef.current) return
        if (!isLeader) return
        if (shots.length === 0) return

        // Get valid shots (not misfired)
        const validShots = shots
            .filter(s => !hasMisfired(misfires, s.playerId))
            .sort((a, b) => a.timestamp - b.timestamp)

        if (validShots.length > 0) {
            gameEndedRef.current = true
            const fastest = validShots[0]
            const reactionTime = gameState.drawSignalTime
                ? fastest.timestamp - gameState.drawSignalTime
                : 0

            console.log('[HIGHNOON] Winner determined:', fastest.playerId, 'reaction:', reactionTime)
            playWinFanfare()
            endGame(fastest.playerId, [
                { playerId: fastest.playerId, score: 100, rank: 1, metadata: { reactionTime } }
            ])
        }
    }, [shots, gameState.localPhase, misfires, gameState.drawSignalTime, winnerId, endGame, players, currentPlayerId])

    // Check for game end when all players misfired
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId

        if (!isPlaying || winnerId || gameEndedRef.current) return
        if (!isLeader) return
        if (players.length === 0) return

        // Check if ALL players have misfired
        const allMisfired = players.every(p => hasMisfired(misfires, p.id))

        if (allMisfired) {
            console.log('[HIGHNOON] All players misfired! No winner.')
            gameEndedRef.current = true
            playFail()
            endGame(null)
        }
    }, [misfires, players, winnerId, isPlaying, endGame, currentPlayerId])

    // Check for single remaining player after misfire
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId

        if (!isPlaying || winnerId || gameEndedRef.current) return
        if (!isLeader) return
        if (players.length < 2) return

        const validPlayers = players.filter(p => !hasMisfired(misfires, p.id))

        if (validPlayers.length === 1 && misfires.length > 0) {
            console.log('[HIGHNOON] Only one player remaining:', validPlayers[0].id)
            gameEndedRef.current = true
            playWinFanfare()
            endGame(validPlayers[0].id, [
                { playerId: validPlayers[0].id, score: 100, rank: 1, metadata: { byDefault: true } }
            ])
        }
    }, [misfires, players, winnerId, isPlaying, endGame, currentPlayerId])

    const handleTap = useCallback(() => {
        if (!currentPlayerId || hasShotRef.current || winnerId) return
        if (hasMisfired(misfires, currentPlayerId)) return

        hasShotRef.current = true
        const timestamp = Date.now()

        if (gameState.localPhase === 'WAIT') {
            console.log('[HIGHNOON] Misfire!')
            playFail()
            dispatchGameEvent('HIGHNOON_MISFIRE', { playerId: currentPlayerId })
            return
        }

        if (gameState.localPhase === 'DRAW') {
            console.log('[HIGHNOON] Shot fired!')
            playGunshot()
            dispatchGameEvent('HIGHNOON_SHOOT', { playerId: currentPlayerId, timestamp })
        }
    }, [currentPlayerId, gameState.localPhase, misfires, winnerId, dispatchGameEvent])

    // Background color based on state
    const bgColor = gameState.localPhase === 'DRAW'
        ? 'bg-red-700'
        : hasMisfired(misfires, currentPlayerId ?? '')
            ? 'bg-yellow-600'
            : 'bg-gradient-to-b from-amber-900 to-amber-800'

    const getMessage = () => {
        if (hasMisfired(misfires, currentPlayerId ?? '')) return '💀 TOO EARLY!'
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
                    <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-amber-800 to-amber-700" />
                    <div
                        className="absolute top-8 right-8 w-16 h-16 rounded-full bg-yellow-400 opacity-80"
                        style={{ boxShadow: '0 0 40px #FFD700' }}
                    />

                    <div className="relative w-full max-w-4xl h-64 flex items-end justify-between px-8 md:px-16">
                        {players.slice(0, 2).map((player, idx) => {
                            const playerMisfired = hasMisfired(misfires, player.id)
                            const playerShot = hasShot(shots, player.id)
                            const isMe = player.id === currentPlayerId

                            return (
                                <motion.div
                                    key={player.id}
                                    className="flex flex-col items-center"
                                    animate={{
                                        y: playerMisfired ? 20 : 0,
                                        rotate: playerMisfired ? (idx === 0 ? 45 : -45) : 0,
                                        opacity: playerMisfired ? 0.5 : 1
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
                                        {playerMisfired ? '💀' : playerShot ? '💥' : '🤠'}
                                    </div>
                                    {playerMisfired && (
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
                        {hasMisfired(misfires, currentPlayerId ?? '') ? (
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
