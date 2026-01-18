import { useEffect, useState, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'SHUFFLING' | 'PICKING' | 'REVEAL' | 'ENDED'

const TOTAL_ROUNDS = 5

const ShellGame: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [round, setRound] = useState(0)
    const [ballPosition, setBallPosition] = useState(1) // 0, 1, or 2
    const [cupPositions, setCupPositions] = useState([0, 1, 2])
    const [scores, setScores] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [picks, setPicks] = useState<Map<string, number>>(new Map())
    const [showBall, setShowBall] = useState(true)
    const [winner, setWinner] = useState<string | null>(null)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false

    useEffect(() => {
        const handleInteraction = () => { unlockAudio(); window.removeEventListener('pointerdown', handleInteraction) }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    useEffect(() => {
        if (phase !== 'COUNTDOWN') return
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(interval); playCountdownBeep(true); if (isHost) startRound(); return 0 }
                playCountdownBeep(false); return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase, isHost])

    const startRound = useCallback(() => {
        const newRound = round + 1
        if (newRound > TOTAL_ROUNDS) {
            const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1])
            broadcastAndApply({ type: 'SHELL_GAME_OVER', winnerId: sortedScores[0]?.[0] })
            return
        }

        const ballPos = Math.floor(Math.random() * 3)
        broadcastAndApply({ type: 'SHELL_NEW_ROUND', round: newRound, ballPosition: ballPos })
    }, [round, scores, broadcastAndApply])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'SHELL_NEW_ROUND') {
            setRound(lastBroadcast.round)
            setBallPosition(lastBroadcast.ballPosition)
            setCupPositions([0, 1, 2])
            setPicks(new Map())
            setShowBall(true)
            setPhase('SHUFFLING')

            // Show ball briefly, then shuffle
            setTimeout(() => {
                setShowBall(false)

                // Shuffle animation sequence
                let shuffleCount = 0
                const doShuffle = () => {
                    shuffleCount++
                    const i = Math.floor(Math.random() * 3)
                    const j = (i + 1 + Math.floor(Math.random() * 2)) % 3

                    setCupPositions(prev => {
                        const next = [...prev]
                            ;[next[i], next[j]] = [next[j], next[i]]
                        return next
                    })

                    if (shuffleCount < 8) setTimeout(doShuffle, 300)
                    else {
                        setTimeout(() => setPhase('PICKING'), 500)
                    }
                }

                setTimeout(doShuffle, 500)
            }, 1500)
        }

        if (lastBroadcast.type === 'SHELL_PICK') {
            setPicks(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.pick)

                if (next.size === players.length && isHost) {
                    setTimeout(() => broadcastAndApply({ type: 'SHELL_REVEAL' }), 500)
                }
                return next
            })
        }

        if (lastBroadcast.type === 'SHELL_REVEAL') {
            setPhase('REVEAL')
            setShowBall(true)

            // Calculate who got it right
            const actualPos = cupPositions.indexOf(ballPosition)
            picks.forEach((pick, playerId) => {
                if (pick === actualPos) {
                    if (playerId === currentPlayer?.id) playWinFanfare()
                    setScores(prev => {
                        const next = new Map(prev)
                        next.set(playerId, (prev.get(playerId) || 0) + 1)
                        return next
                    })
                } else {
                    if (playerId === currentPlayer?.id) playFail()
                }
            })

            if (isHost) setTimeout(() => startRound(), 2500)
        }

        if (lastBroadcast.type === 'SHELL_GAME_OVER') {
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, players, currentPlayer?.id, isHost, ballPosition, cupPositions, picks, startRound, onGameEnd, broadcastAndApply])

    const handlePick = useCallback((cupIndex: number) => {
        if (phase !== 'PICKING' || !currentPlayer || picks.has(currentPlayer.id)) return
        playTap()
        broadcastAndApply({ type: 'SHELL_PICK', playerId: currentPlayer.id, pick: cupIndex })
    }, [phase, currentPlayer, picks, broadcastAndApply])

    const CUP_COLORS = ['#8B4513', '#A0522D', '#D2691E']

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-amber-800 to-amber-950 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🎩 ¿DÓNDE ESTÁ LA BOLITA?</h1>
                {phase !== 'COUNTDOWN' && phase !== 'ENDED' && (
                    <div className="text-lg text-yellow-400">Ronda {round} / {TOTAL_ROUNDS}</div>
                )}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && phase !== 'ENDED' && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex gap-4">
                        {[0, 1, 2].map(visualIndex => {
                            const actualCupIndex = cupPositions[visualIndex]
                            const hasBall = actualCupIndex === ballPosition
                            const myPick = picks.get(currentPlayer?.id || '')
                            const isPicked = myPick === visualIndex

                            return (
                                <motion.div
                                    key={visualIndex}
                                    layout
                                    className="relative cursor-pointer"
                                    onClick={() => handlePick(visualIndex)}
                                >
                                    {/* Cup */}
                                    <motion.div
                                        animate={{
                                            y: phase === 'REVEAL' && hasBall ? -60 : 0,
                                            rotateY: phase === 'SHUFFLING' ? [0, 10, -10, 0] : 0
                                        }}
                                        transition={{ type: 'spring' }}
                                        className={clsx(
                                            "w-20 h-24 rounded-t-full",
                                            isPicked && "ring-4 ring-yellow-400"
                                        )}
                                        style={{
                                            background: `linear-gradient(to right, ${CUP_COLORS[0]}, ${CUP_COLORS[1]}, ${CUP_COLORS[0]})`,
                                            clipPath: 'polygon(10% 100%, 90% 100%, 100% 0%, 0% 0%)'
                                        }}
                                    />

                                    {/* Ball (only visible when showing) */}
                                    {showBall && hasBall && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-red-500"
                                            style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                                        />
                                    )}

                                    {/* Pick indicator */}
                                    {isPicked && (
                                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-yellow-400">
                                            👆
                                        </div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Status */}
            {phase === 'SHUFFLING' && (
                <div className="text-2xl text-white animate-pulse">🔀 Mezclando...</div>
            )}
            {phase === 'PICKING' && !picks.has(currentPlayer?.id || '') && (
                <div className="text-2xl text-yellow-400 animate-pulse">👆 ¡Elige un vaso!</div>
            )}
            {phase === 'PICKING' && picks.has(currentPlayer?.id || '') && (
                <div className="text-xl text-green-400">✓ Esperando a otros...</div>
            )}

            {/* Scores */}
            <div className="flex gap-4 pb-4">
                {players.map(player => (
                    <div key={player.id} className={clsx("text-center px-4 py-2 rounded-lg", player.id === currentPlayer?.id ? "bg-amber-700" : "bg-white/10")}>
                        <div className="text-sm text-white/70">{player.username}</div>
                        <div className="text-2xl font-pixel text-yellow-400">{scores.get(player.id) || 0}</div>
                    </div>
                ))}
            </div>

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🎩</div>
                        <div className="text-4xl font-pixel text-yellow-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default ShellGame
