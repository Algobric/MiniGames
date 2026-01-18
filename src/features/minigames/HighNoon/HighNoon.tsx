import { useEffect, useState, useRef, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { useFairTiming } from '../../../hooks/useFairTiming'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { getCowboySprite } from './sprites'
import { playGunshot, playDrawSignal, playWinFanfare, playFail, unlockAudio } from './sounds'

type Phase = 'WAIT' | 'DRAW' | 'ENDED'
type CowboyState = 'idle' | 'draw' | 'shoot' | 'hit'

interface ShootEvent {
    playerId: string
    timestamp: number // Adjusted timestamp using fair timing
    rawTimestamp: number // Original client timestamp for debugging
}

interface PlayerState {
    id: string
    username: string
    cowboyState: CowboyState
    reactionTime?: number
    disqualified: boolean
}

const PLAYER_COLORS = ['#DC143C', '#1E90FF', '#32CD32', '#FFD700', '#FF69B4', '#00CED1', '#FF4500', '#9400D3']

const HighNoon: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()
    const { getServerTimestamp, estimatedRtt, isCalibrated } = useFairTiming()

    const [phase, setPhase] = useState<Phase>('WAIT')
    const [winner, setWinner] = useState<string | null>(null)
    const [message, setMessage] = useState('STEADY...')
    const [bgColor, setBgColor] = useState('bg-atari-black')
    const [showMuzzleFlash, setShowMuzzleFlash] = useState<string | null>(null)

    // Track all player states
    const [playerStates, setPlayerStates] = useState<Map<string, PlayerState>>(
        new Map(players.map((p) => [p.id, {
            id: p.id,
            username: p.username,
            cowboyState: 'idle' as CowboyState,
            disqualified: false
        }]))
    )

    // Refs for game state
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const drawTimeRef = useRef<number>(0)
    const shootEventsRef = useRef<ShootEvent[]>([])
    const gameEndedRef = useRef(false)
    const hasShot = useRef(false)
    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false

    // Unlock audio on first interaction
    useEffect(() => {
        const handleInteraction = () => {
            unlockAudio()
            window.removeEventListener('pointerdown', handleInteraction)
        }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    // HOST: Schedule the DRAW signal after a random delay
    useEffect(() => {
        if (!isHost) return

        // Wait for calibration if we have guests
        const delay = Math.random() * 3000 + 2000 // 2-5 seconds
        console.log(`[HOST] Scheduling DRAW in ${delay}ms`)

        timerRef.current = setTimeout(() => {
            const drawTime = Date.now()
            console.log(`[HOST] Broadcasting SIGNAL_DRAW at ${drawTime}`)
            broadcastAndApply({
                type: 'SIGNAL_DRAW',
                drawTime
            })
        }, delay)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [isHost, broadcastAndApply])

    // ALL CLIENTS: Listen for broadcast events
    useEffect(() => {
        if (!lastBroadcast || gameEndedRef.current) return

        console.log('[CLIENT] Received broadcast:', lastBroadcast)

        // Handle DRAW signal
        if (lastBroadcast.type === 'SIGNAL_DRAW') {
            setPhase('DRAW')
            setBgColor('bg-red-700')
            setMessage('🔥 FIRE! 🔥')
            drawTimeRef.current = lastBroadcast.drawTime || Date.now()
            shootEventsRef.current = []
            playDrawSignal()

            // All cowboys draw their guns
            setPlayerStates(prev => {
                const next = new Map(prev)
                for (const [id, state] of next) {
                    if (!state.disqualified) {
                        next.set(id, { ...state, cowboyState: 'draw' })
                    }
                }
                return next
            })

            // HOST: Set a timeout - if no one shoots in 5 seconds, it's a draw
            if (isHost) {
                timerRef.current = setTimeout(() => {
                    if (gameEndedRef.current) return

                    // Check if anyone has shot
                    if (shootEventsRef.current.length === 0) {
                        console.log('[HOST] Timeout - no shots fired, ending as draw')
                        broadcastAndApply({
                            type: 'GAME_RESULT',
                            winnerId: null,
                            isDraw: true,
                            message: 'NOBODY FIRED! DRAW!'
                        })
                    }
                }, 5000)
            }
        }

        // Handle SHOOT events
        if (lastBroadcast.type === 'SHOOT') {
            const shootEvent: ShootEvent = {
                playerId: lastBroadcast.playerId,
                timestamp: lastBroadcast.timestamp,
                rawTimestamp: lastBroadcast.rawTimestamp
            }

            shootEventsRef.current.push(shootEvent)
            playGunshot()

            // Show muzzle flash
            setShowMuzzleFlash(lastBroadcast.playerId)
            setTimeout(() => setShowMuzzleFlash(null), 100)

            // Update cowboy state to shooting
            setPlayerStates(prev => {
                const next = new Map(prev)
                const state = next.get(lastBroadcast.playerId)
                if (state) {
                    next.set(lastBroadcast.playerId, { ...state, cowboyState: 'shoot' })
                }
                return next
            })

            // Host determines winner after collecting shots
            if (isHost && !gameEndedRef.current) {
                setTimeout(() => {
                    if (gameEndedRef.current) return

                    // Find earliest valid shot (after DRAW time)
                    const validShots = shootEventsRef.current
                        .filter(e => e.timestamp >= drawTimeRef.current)
                        .sort((a, b) => a.timestamp - b.timestamp)

                    console.log('[HOST] Valid shots:', validShots)

                    if (validShots.length > 0) {
                        const winnerEvent = validShots[0]
                        const reactionTime = winnerEvent.timestamp - drawTimeRef.current

                        // Calculate all reaction times
                        const allResults = validShots.map(e => ({
                            playerId: e.playerId,
                            reactionTime: e.timestamp - drawTimeRef.current
                        }))

                        broadcastAndApply({
                            type: 'GAME_RESULT',
                            winnerId: winnerEvent.playerId,
                            reactionTime,
                            allResults
                        })
                    }
                }, 150) // Small delay to collect near-simultaneous shots
            }
        }

        // Handle MISFIRE events
        if (lastBroadcast.type === 'MISFIRE') {
            playFail()
            setPlayerStates(prev => {
                const next = new Map(prev)
                const state = next.get(lastBroadcast.playerId)
                if (state) {
                    next.set(lastBroadcast.playerId, {
                        ...state,
                        cowboyState: 'hit',
                        disqualified: true
                    })
                }
                return next
            })

            if (lastBroadcast.playerId === currentPlayer?.id) {
                setMessage('TOO EARLY!')
                setBgColor('bg-yellow-600')
            }
        }

        // Handle GAME_RESULT
        if (lastBroadcast.type === 'GAME_RESULT') {
            gameEndedRef.current = true
            if (timerRef.current) clearTimeout(timerRef.current)

            const winnerId = lastBroadcast.winnerId
            const isDraw = lastBroadcast.isDraw || !winnerId
            const winnerPlayer = winnerId ? players.find(p => p.id === winnerId) : null

            setWinner(winnerId)
            setPhase('ENDED')

            if (isDraw) {
                setMessage(lastBroadcast.message || '🤝 DRAW!')
                setBgColor('bg-gray-600')
            } else {
                setMessage(`${winnerPlayer?.username || 'Unknown'} WINS!`)
                setBgColor(winnerId === currentPlayer?.id ? 'bg-green-700' : 'bg-gray-700')

                if (winnerId === currentPlayer?.id) {
                    playWinFanfare()
                }
            }

            // Update player states with results
            setPlayerStates(prev => {
                const next = new Map(prev)
                for (const result of lastBroadcast.allResults || []) {
                    const state = next.get(result.playerId)
                    if (state) {
                        next.set(result.playerId, {
                            ...state,
                            reactionTime: result.reactionTime,
                            cowboyState: result.playerId === winnerId ? 'shoot' : 'hit'
                        })
                    }
                }
                return next
            })

            // Host triggers game end
            if (isHost) {
                setTimeout(() => {
                    onGameEnd({ winnerId: winnerId || undefined })
                }, 3000)
            }
        }
    }, [lastBroadcast, isHost, currentPlayer?.id, players, broadcastAndApply, onGameEnd])

    // Handle player tap/click
    const handleTrigger = useCallback(() => {
        if (!currentPlayer || gameEndedRef.current || hasShot.current) return

        const myState = playerStates.get(currentPlayer.id)
        if (myState?.disqualified) return

        if (phase === 'WAIT') {
            // MISFIRE - clicked too early!
            console.log('[CLIENT] MISFIRE!')
            hasShot.current = true
            broadcastAndApply({
                type: 'MISFIRE',
                playerId: currentPlayer.id
            })
            return
        }

        if (phase === 'DRAW' && !winner) {
            // Valid shot! Use fair timing
            const adjustedTimestamp = getServerTimestamp()
            const rawTimestamp = Date.now()

            console.log(`[CLIENT] SHOOT - adjusted: ${adjustedTimestamp}, raw: ${rawTimestamp}, RTT: ${estimatedRtt}ms`)

            hasShot.current = true
            broadcastAndApply({
                type: 'SHOOT',
                playerId: currentPlayer.id,
                timestamp: adjustedTimestamp,
                rawTimestamp
            })
        }
    }, [currentPlayer, phase, winner, playerStates, broadcastAndApply, getServerTimestamp, estimatedRtt])

    // Get player display info
    const getPlayerIndex = (playerId: string) => players.findIndex(p => p.id === playerId)
    const myState = currentPlayer ? playerStates.get(currentPlayer.id) : null

    return (
        <div
            className={clsx(
                "flex flex-col items-center justify-between w-full h-full transition-colors duration-100 select-none cursor-pointer overflow-hidden",
                bgColor
            )}
            onPointerDown={handleTrigger}
        >
            {/* Top message area */}
            <div className="pt-8 text-center z-10">
                <motion.h1
                    key={message}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-4xl md:text-7xl font-pixel text-white"
                    style={{ textShadow: '0 0 20px currentColor, 0 4px 0 #000' }}
                >
                    {message}
                </motion.h1>

                {phase === 'ENDED' && winner && (
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl md:text-3xl text-atari-yellow mt-4"
                    >
                        {playerStates.get(winner)?.reactionTime}ms reaction time!
                    </motion.p>
                )}
            </div>

            {/* Cowboys arena */}
            <div className="flex-1 w-full flex items-center justify-center relative">
                {/* Desert floor */}
                <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-amber-800 to-amber-700" />

                {/* Sun */}
                <div className="absolute top-8 right-8 w-16 h-16 rounded-full bg-yellow-400 opacity-80"
                    style={{ boxShadow: '0 0 40px #FFD700' }} />

                {/* Cowboys */}
                <div className="relative w-full max-w-4xl h-64 flex items-end justify-between px-8 md:px-16">
                    {players.slice(0, 2).map((player, idx) => {
                        const state = playerStates.get(player.id)
                        const facing = idx === 0 ? 'right' : 'left'
                        const color = PLAYER_COLORS[getPlayerIndex(player.id) % PLAYER_COLORS.length]

                        return (
                            <motion.div
                                key={player.id}
                                className="flex flex-col items-center"
                                animate={{
                                    y: state?.cowboyState === 'hit' ? 20 : 0,
                                    rotate: state?.cowboyState === 'hit' ? (idx === 0 ? 45 : -45) : 0,
                                    opacity: state?.disqualified ? 0.5 : 1
                                }}
                            >
                                {/* Player name */}
                                <div className={clsx(
                                    "text-sm md:text-base font-pixel mb-2 px-2 py-1 rounded",
                                    player.id === currentPlayer?.id ? "bg-atari-green text-black" : "bg-black/50 text-white"
                                )}>
                                    {player.username}
                                </div>

                                {/* Cowboy sprite */}
                                <div className="relative">
                                    <img
                                        src={getCowboySprite(facing, state?.cowboyState || 'idle', color)}
                                        alt={`Cowboy ${player.username}`}
                                        className="w-16 h-24 md:w-24 md:h-36"
                                        style={{ imageRendering: 'pixelated' }}
                                    />

                                    {/* Muzzle flash */}
                                    <AnimatePresence>
                                        {showMuzzleFlash === player.id && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 1 }}
                                                animate={{ scale: 1.5, opacity: 0 }}
                                                exit={{ opacity: 0 }}
                                                className={clsx(
                                                    "absolute top-1/2 w-8 h-8 rounded-full bg-yellow-400",
                                                    idx === 0 ? "right-0 translate-x-full" : "left-0 -translate-x-full"
                                                )}
                                                style={{ boxShadow: '0 0 20px #FFD700' }}
                                            />
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Reaction time */}
                                {state?.reactionTime !== undefined && (
                                    <div className="text-xs md:text-sm text-atari-cyan mt-2">
                                        {state.reactionTime}ms
                                    </div>
                                )}

                                {/* Disqualified badge */}
                                {state?.disqualified && (
                                    <div className="text-xs text-red-400 mt-1">
                                        DISQUALIFIED
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>

                {/* More than 2 players: show as spectator list */}
                {players.length > 2 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                        {players.slice(2).map(player => {
                            const state = playerStates.get(player.id)
                            return (
                                <div key={player.id} className="text-center opacity-70">
                                    <div className="text-xs text-white">{player.username}</div>
                                    {state?.reactionTime && (
                                        <div className="text-xs text-atari-cyan">{state.reactionTime}ms</div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Bottom instructions */}
            <div className="pb-8 text-center z-10">
                <div className="text-lg md:text-xl font-mono text-white/70">
                    {myState?.disqualified ? (
                        <span className="text-yellow-300">DISQUALIFIED - TOO EARLY!</span>
                    ) : phase === 'WAIT' ? (
                        <span className="animate-pulse">WAIT FOR THE SIGNAL...</span>
                    ) : phase === 'DRAW' && !winner && !hasShot.current ? (
                        <motion.span
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 0.3 }}
                            className="text-red-300"
                        >
                            TAP NOW!
                        </motion.span>
                    ) : phase === 'DRAW' && hasShot.current && !winner ? (
                        <span className="text-atari-cyan">SHOT FIRED! WAITING...</span>
                    ) : null}
                </div>

                {/* Debug info */}
                <div className="mt-4 text-xs font-mono text-white/30">
                    {isHost ? 'HOST' : 'GUEST'} | RTT: {estimatedRtt}ms | {isCalibrated ? '✓' : '⏳'}
                </div>
            </div>

            {/* Winner celebration overlay */}
            <AnimatePresence>
                {winner && winner === currentPlayer?.id && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 pointer-events-none flex items-center justify-center"
                    >
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 10 }}
                            className="text-8xl md:text-9xl"
                            style={{ textShadow: '0 0 40px #FFD700' }}
                        >
                            🏆
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Flash effect on DRAW */}
            <AnimatePresence>
                {phase === 'DRAW' && !winner && !hasShot.current && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="absolute inset-0 bg-white pointer-events-none"
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

export default HighNoon
