import { useEffect, useState, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

const WIN_THRESHOLD = 100 // Pull to this to win

const TugOfWar: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [ropePosition, setRopePosition] = useState(0) // -100 to 100, 0 is center
    const [winner, setWinner] = useState<string | null>(null)
    const [pullCounts, setPullCounts] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const myIndex = players.findIndex(p => p.id === currentPlayer?.id)
    const myDirection = myIndex === 0 ? -1 : 1 // First player pulls left, second pulls right

    useEffect(() => {
        const handleInteraction = () => { unlockAudio(); window.removeEventListener('pointerdown', handleInteraction) }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    useEffect(() => {
        if (phase !== 'COUNTDOWN') return
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(interval); playCountdownBeep(true); setPhase('PLAYING'); return 0 }
                playCountdownBeep(false); return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase])

    // Natural rope drift back to center
    useEffect(() => {
        if (phase !== 'PLAYING') return
        const interval = setInterval(() => {
            setRopePosition(prev => prev * 0.99) // Slight drift to center
        }, 50)
        return () => clearInterval(interval)
    }, [phase])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'TUG_PULL') {
            const pullDirection = lastBroadcast.direction
            setRopePosition(prev => {
                const newPos = prev + pullDirection * 3

                // Check win condition
                if (isHost && Math.abs(newPos) >= WIN_THRESHOLD) {
                    const winnerId = newPos < 0 ? players[0]?.id : players[1]?.id
                    setTimeout(() => broadcastAndApply({ type: 'TUG_GAME_OVER', winnerId }), 100)
                }

                return Math.max(-WIN_THRESHOLD, Math.min(WIN_THRESHOLD, newPos))
            })

            setPullCounts(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, (prev.get(lastBroadcast.playerId) || 0) + 1)
                return next
            })
        }

        if (lastBroadcast.type === 'TUG_GAME_OVER') {
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            else playFail()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, players, currentPlayer?.id, isHost, onGameEnd, broadcastAndApply])

    const handlePull = useCallback(() => {
        if (phase !== 'PLAYING' || !currentPlayer) return
        playTap()
        broadcastAndApply({ type: 'TUG_PULL', playerId: currentPlayer.id, direction: myDirection })
    }, [phase, currentPlayer, myDirection, broadcastAndApply])

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-green-700 to-green-900 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🪢 TIRAR DE LA CUERDA!</h1>
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && (
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                    {/* Player labels */}
                    <div className="flex justify-between w-full max-w-md px-4 mb-4">
                        <div className={clsx("text-center", myIndex === 0 && "text-yellow-400")}>
                            <div className="text-2xl">💪</div>
                            <div className="text-sm text-white">{players[0]?.username}</div>
                            <div className="text-xs text-white/70">{pullCounts.get(players[0]?.id) || 0} tirones</div>
                        </div>
                        <div className={clsx("text-center", myIndex === 1 && "text-yellow-400")}>
                            <div className="text-2xl">💪</div>
                            <div className="text-sm text-white">{players[1]?.username}</div>
                            <div className="text-xs text-white/70">{pullCounts.get(players[1]?.id) || 0} tirones</div>
                        </div>
                    </div>

                    {/* Rope visualization */}
                    <div className="relative w-full max-w-md h-16 bg-amber-800 rounded-lg border-4 border-amber-900 overflow-hidden">
                        {/* Center marker */}
                        <div className="absolute top-0 left-1/2 w-1 h-full bg-white/50 -translate-x-1/2" />

                        {/* Win zones */}
                        <div className="absolute top-0 left-0 w-4 h-full bg-red-500/50" />
                        <div className="absolute top-0 right-0 w-4 h-full bg-blue-500/50" />

                        {/* Rope marker */}
                        <motion.div
                            animate={{ x: ropePosition * 2 }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        >
                            <div className="w-8 h-8 bg-yellow-600 rounded-full border-4 border-yellow-400 shadow-lg" />
                            <div className="absolute top-1/2 -left-32 w-32 h-3 bg-amber-600 rounded-l-full -translate-y-1/2" />
                            <div className="absolute top-1/2 left-full w-32 h-3 bg-amber-600 rounded-r-full -translate-y-1/2" />
                        </motion.div>
                    </div>

                    {/* Direction indicator */}
                    <div className="mt-4 text-white text-lg">
                        {myIndex === 0 ? '⬅️ TIRA HACIA TI' : '➡️ TIRA HACIA TI'}
                    </div>
                </div>
            )}

            {phase === 'PLAYING' && (
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handlePull}
                    className="px-12 py-6 text-2xl font-pixel bg-yellow-500 text-black rounded-xl shadow-lg mb-4"
                >
                    💪 TIRAR!
                </motion.button>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🏆</div>
                        <div className="text-4xl font-pixel text-yellow-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default TugOfWar
