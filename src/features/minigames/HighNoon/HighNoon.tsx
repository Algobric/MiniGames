import { useEffect, useState, useRef, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'

type Phase = 'WAIT' | 'DRAW' | 'ENDED'

interface ShootEvent {
    playerId: string
    timestamp: number
}

const HighNoon: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()
    const [phase, setPhase] = useState<Phase>('WAIT')
    const [winner, setWinner] = useState<string | null>(null)
    const [message, setMessage] = useState('STEADY...')
    const [bgColor, setBgColor] = useState('bg-atari-black')
    const [disqualified, setDisqualified] = useState(false)

    // Refs for game state that shouldn't trigger re-renders
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const drawTimeRef = useRef<number>(0)
    const shootEventsRef = useRef<ShootEvent[]>([])
    const gameEndedRef = useRef(false)
    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    // HOST: Schedule the DRAW signal after a random delay
    useEffect(() => {
        if (!isHost) return

        const delay = Math.random() * 3000 + 2000 // 2-5 seconds
        console.log(`[HOST] Scheduling DRAW in ${delay}ms`)

        timerRef.current = setTimeout(() => {
            const drawTime = Date.now()
            console.log(`[HOST] Broadcasting SIGNAL_DRAW at ${drawTime}`)
            // Use broadcastAndApply so HOST also receives this locally!
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
            setBgColor('bg-red-600')
            setMessage('DRAW!')
            drawTimeRef.current = lastBroadcast.drawTime || Date.now()
            shootEventsRef.current = [] // Reset shoot events
        }

        // Handle SHOOT events
        if (lastBroadcast.type === 'SHOOT') {
            const shootEvent: ShootEvent = {
                playerId: lastBroadcast.playerId,
                timestamp: lastBroadcast.timestamp
            }

            // Add to events (we may receive multiple)
            shootEventsRef.current.push(shootEvent)

            // If we're the host, determine winner after a short collection window
            if (isHost && !gameEndedRef.current) {
                // Small delay to collect any near-simultaneous shots
                setTimeout(() => {
                    if (gameEndedRef.current) return
                    gameEndedRef.current = true

                    // Find earliest valid shot (after DRAW time)
                    const validShots = shootEventsRef.current
                        .filter(e => e.timestamp >= drawTimeRef.current)
                        .sort((a, b) => a.timestamp - b.timestamp)

                    if (validShots.length > 0) {
                        const winnerEvent = validShots[0]
                        broadcastAndApply({
                            type: 'GAME_RESULT',
                            winnerId: winnerEvent.playerId,
                            reactionTime: winnerEvent.timestamp - drawTimeRef.current
                        })
                    }
                }, 100)
            }
        }

        // Handle MISFIRE events
        if (lastBroadcast.type === 'MISFIRE') {
            // If it's the current player who misfired
            if (lastBroadcast.playerId === currentPlayer?.id) {
                setDisqualified(true)
            }
        }

        // Handle GAME_RESULT (final announcement)
        if (lastBroadcast.type === 'GAME_RESULT') {
            gameEndedRef.current = true
            const winnerId = lastBroadcast.winnerId
            const winnerName = players.find(p => p.id === winnerId)?.username || 'Unknown'
            const reactionMs = lastBroadcast.reactionTime || 0

            setWinner(winnerId)
            setPhase('ENDED')
            setMessage(`${winnerName} WINS! (${reactionMs}ms)`)
            setBgColor(winnerId === currentPlayer?.id ? 'bg-green-600' : 'bg-gray-700')

            // Host triggers game end callback
            if (isHost) {
                setTimeout(() => {
                    onGameEnd({ winnerId })
                }, 3000)
            }
        }

    }, [lastBroadcast, isHost, currentPlayer?.id, players, broadcastAndApply, onGameEnd])

    // Handle player tap/click
    const handleTrigger = useCallback(() => {
        if (!currentPlayer || gameEndedRef.current || disqualified) return

        if (phase === 'WAIT') {
            // MISFIRE - clicked too early!
            console.log('[CLIENT] MISFIRE!')
            setMessage('TOO EARLY!')
            setBgColor('bg-yellow-600')
            setDisqualified(true)
            broadcastAndApply({
                type: 'MISFIRE',
                playerId: currentPlayer.id
            })
            return
        }

        if (phase === 'DRAW' && !winner) {
            // Valid shot!
            const timestamp = Date.now()
            console.log(`[CLIENT] SHOOT at ${timestamp}`)
            broadcastAndApply({
                type: 'SHOOT',
                playerId: currentPlayer.id,
                timestamp
            })
        }
    }, [currentPlayer, phase, winner, disqualified, broadcastAndApply])

    return (
        <div
            className={clsx(
                "flex flex-col items-center justify-center w-full h-full transition-colors duration-100 p-4 select-none cursor-pointer",
                bgColor
            )}
            onPointerDown={handleTrigger}
        >
            {/* Main message */}
            <h1 className="text-4xl md:text-8xl font-pixel text-center text-white mb-8 animate-pulse"
                style={{ textShadow: '0 0 20px currentColor' }}>
                {message}
            </h1>

            {/* Flash effect on DRAW */}
            <AnimatePresence>
                {phase === 'DRAW' && !winner && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="absolute inset-0 bg-white pointer-events-none"
                    />
                )}
            </AnimatePresence>

            {/* Instructions */}
            <div className="text-xl font-mono mt-8 text-white/70 text-center">
                {disqualified ? (
                    <span className="text-yellow-300">DISQUALIFIED - TOO EARLY!</span>
                ) : phase === 'WAIT' ? (
                    <span>WAIT FOR THE SIGNAL...</span>
                ) : phase === 'DRAW' && !winner ? (
                    <span className="animate-pulse">TAP NOW!</span>
                ) : null}
            </div>

            {/* Winner animation */}
            <AnimatePresence>
                {winner && (
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="absolute text-8xl"
                        style={{ textShadow: '0 0 30px #ff0' }}
                    >
                        🤠
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Debug info (can be removed in production) */}
            <div className="absolute bottom-4 left-4 text-xs font-mono text-white/30">
                {isHost ? 'HOST' : 'GUEST'} | Phase: {phase}
            </div>
        </div>
    )
}

export default HighNoon
