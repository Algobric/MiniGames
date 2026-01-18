import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { useFairTiming } from '../../../hooks/useFairTiming'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'RUNNING' | 'ENDED'

const TARGET_TIME = 10000 // 10.00 seconds

const StopWatch: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()
    const { getServerTimestamp } = useFairTiming()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [startTime, setStartTime] = useState(0)
    const [stoppedTimes, setStoppedTimes] = useState<Map<string, number>>(new Map())
    const [hasStopped, setHasStopped] = useState(false)
    const [winner, setWinner] = useState<string | null>(null)
    const displayRef = useRef<number>(0)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false

    // Reset ref on mount
    useEffect(() => {
        displayRef.current = 0
    }, [])

    useEffect(() => {
        const handleInteraction = () => { unlockAudio(); window.removeEventListener('pointerdown', handleInteraction) }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    useEffect(() => {
        if (phase !== 'COUNTDOWN') return
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    playCountdownBeep(true)
                    const now = Date.now()
                    setStartTime(now)
                    if (isHost) broadcastAndApply({ type: 'STOPWATCH_START', startTime: now })
                    setPhase('RUNNING')
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase, isHost, broadcastAndApply])

    // Hidden timer animation (for display purposes only)
    useEffect(() => {
        if (phase !== 'RUNNING') return
        const interval = setInterval(() => {
            displayRef.current = Date.now() - startTime
        }, 10)
        return () => clearInterval(interval)
    }, [phase, startTime])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'STOPWATCH_START') {
            setStartTime(lastBroadcast.startTime)
        }

        if (lastBroadcast.type === 'STOPWATCH_STOP') {
            setStoppedTimes(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.time)

                // Check if all players have stopped
                if (next.size === players.length && isHost) {
                    // Find winner (closest to TARGET_TIME)
                    let winnerId = ''
                    let closestDiff = Infinity

                    for (const [playerId, time] of next) {
                        const diff = Math.abs(time - TARGET_TIME)
                        if (diff < closestDiff) {
                            closestDiff = diff
                            winnerId = playerId
                        }
                    }

                    setTimeout(() => broadcastAndApply({ type: 'STOPWATCH_GAME_OVER', winnerId, times: Object.fromEntries(next) }), 500)
                }

                return next
            })
        }

        if (lastBroadcast.type === 'STOPWATCH_GAME_OVER') {
            setPhase('ENDED')
            setWinner(lastBroadcast.winnerId)
            setStoppedTimes(new Map(Object.entries(lastBroadcast.times)))
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 4000)
        }
    }, [lastBroadcast, players, currentPlayer?.id, isHost, onGameEnd, broadcastAndApply])

    const handleStop = useCallback(() => {
        if (phase !== 'RUNNING' || !currentPlayer || hasStopped) return

        const stopTime = getServerTimestamp() - startTime
        setHasStopped(true)
        playTap()

        broadcastAndApply({
            type: 'STOPWATCH_STOP',
            playerId: currentPlayer.id,
            time: stopTime
        })
    }, [phase, currentPlayer, hasStopped, startTime, getServerTimestamp, broadcastAndApply])

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000)
        const cents = Math.floor((ms % 1000) / 10)
        return `${seconds.toString().padStart(2, '0')}.${cents.toString().padStart(2, '0')}`
    }

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-gray-800 to-black select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>⏱️ STOP EXACTO!</h1>
                <p className="text-lg text-cyan-400">Detén el reloj lo más cerca de {formatTime(TARGET_TIME)}</p>
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase === 'RUNNING' && !hasStopped && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-6xl font-pixel text-red-500 mb-4">???</div>
                    <p className="text-white/70 mb-8">El cronómetro está corriendo...</p>
                    <p className="text-sm text-white/50">No puedes verlo. ¡Calcula cuándo parar!</p>
                </div>
            )}

            {phase === 'RUNNING' && hasStopped && (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-4xl font-pixel text-green-400 mb-4">✓ DETENIDO</div>
                    <p className="text-white/70">Esperando a los demás jugadores...</p>
                </div>
            )}

            {phase === 'RUNNING' && !hasStopped && (
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleStop}
                    className="px-16 py-8 text-3xl font-pixel bg-red-600 text-white rounded-full shadow-lg mb-4"
                    style={{ boxShadow: '0 0 30px #FF0000' }}
                >
                    ⏹️ STOP!
                </motion.button>
            )}

            {phase === 'ENDED' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-4xl mb-6">⏱️ RESULTADOS</div>
                        <div className="text-2xl text-cyan-400 mb-4">Objetivo: {formatTime(TARGET_TIME)}</div>

                        <div className="space-y-3 mb-6">
                            {players.map(player => {
                                const time = stoppedTimes.get(player.id) || 0
                                const diff = Math.abs(time - TARGET_TIME)
                                const isWinner = player.id === winner

                                return (
                                    <motion.div
                                        key={player.id}
                                        initial={{ x: -50, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        className={clsx(
                                            "flex justify-between items-center px-4 py-2 rounded-lg",
                                            isWinner ? "bg-yellow-500/30 border-2 border-yellow-400" : "bg-white/10"
                                        )}
                                    >
                                        <span className="text-white">{player.username}</span>
                                        <span className={clsx("font-pixel", isWinner ? "text-yellow-400" : "text-white")}>
                                            {formatTime(time)} ({diff < 100 ? '+' : ''}{(diff / 1000).toFixed(2)}s)
                                        </span>
                                    </motion.div>
                                )
                            })}
                        </div>

                        <div className="text-3xl font-pixel text-yellow-400">
                            🏆 {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default StopWatch
