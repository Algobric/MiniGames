import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { useFairTiming } from '../../../hooks/useFairTiming'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const NumberOrder: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()
    const { getServerTimestamp } = useFairTiming()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [shuffledNumbers, setShuffledNumbers] = useState<number[]>([])
    const [nextNumber, setNextNumber] = useState(1)
    const [startTime, setStartTime] = useState(0)
    const [progress, setProgress] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [winner, setWinner] = useState<string | null>(null)
    const [finishTimes, setFinishTimes] = useState<Map<string, number>>(new Map())

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const isHostRef = useRef(isHost)
    isHostRef.current = isHost

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
                    if (isHostRef.current) {
                        const shuffled = [...NUMBERS].sort(() => Math.random() - 0.5)
                        const now = Date.now()
                        broadcastAndApply({ type: 'NUMBER_START', numbers: shuffled, startTime: now })
                    }
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [phase, broadcastAndApply])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'NUMBER_START') {
            setShuffledNumbers(lastBroadcast.numbers)
            setStartTime(lastBroadcast.startTime)
            setPhase('PLAYING')
        }

        if (lastBroadcast.type === 'NUMBER_PROGRESS') {
            setProgress(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.progress)
                return next
            })
        }

        if (lastBroadcast.type === 'NUMBER_FINISH') {
            setFinishTimes(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.time)
                return next
            })

            if (!winner) {
                setWinner(lastBroadcast.playerId)
                if (lastBroadcast.playerId === currentPlayer?.id) playWinFanfare()
            }
        }

        if (lastBroadcast.type === 'NUMBER_GAME_OVER') {
            setPhase('ENDED')
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, winner, isHost, onGameEnd])

    const handleNumberClick = useCallback((num: number) => {
        if (phase !== 'PLAYING' || !currentPlayer || finishTimes.has(currentPlayer.id)) return

        if (num === nextNumber) {
            playTap()
            const newNext = nextNumber + 1
            setNextNumber(newNext)

            broadcastAndApply({ type: 'NUMBER_PROGRESS', playerId: currentPlayer.id, progress: newNext - 1 })

            if (newNext > NUMBERS.length) {
                const finishTime = getServerTimestamp() - startTime
                broadcastAndApply({ type: 'NUMBER_FINISH', playerId: currentPlayer.id, time: finishTime })

                if (isHost) {
                    setTimeout(() => broadcastAndApply({ type: 'NUMBER_GAME_OVER', winnerId: currentPlayer.id }), 2000)
                }
            }
        } else {
            playFail()
        }
    }, [phase, currentPlayer, nextNumber, startTime, finishTimes, getServerTimestamp, isHost, broadcastAndApply])

    // Position numbers in a grid
    const positions = shuffledNumbers.map((_, i) => ({
        x: (i % 5) * 20 + 10,
        y: Math.floor(i / 5) * 40 + 20
    }))

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-teal-800 to-teal-950 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🔢 ORDENA LOS NÚMEROS!</h1>
                <p className="text-lg text-cyan-400">Haz clic del 1 al 10 en orden</p>
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && (
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                    {/* Number grid */}
                    <div className="relative w-80 h-40 mb-6">
                        {shuffledNumbers.map((num, i) => {
                            const isClicked = num < nextNumber
                            const isNext = num === nextNumber

                            return (
                                <motion.button
                                    key={num}
                                    initial={{ scale: 0 }}
                                    animate={{
                                        scale: isClicked ? 0 : 1,
                                        opacity: isClicked ? 0 : 1
                                    }}
                                    whileHover={{ scale: isClicked ? 0 : 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleNumberClick(num)}
                                    disabled={isClicked || finishTimes.has(currentPlayer?.id || '')}
                                    className={clsx(
                                        "absolute w-12 h-12 rounded-xl text-xl font-pixel",
                                        isNext ? "bg-yellow-500 text-black ring-4 ring-yellow-300" : "bg-teal-600 text-white"
                                    )}
                                    style={{
                                        left: `${positions[i].x}%`,
                                        top: `${positions[i].y}%`,
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                >
                                    {num}
                                </motion.button>
                            )
                        })}
                    </div>

                    {/* Next number indicator */}
                    <div className="text-2xl text-white mb-4">
                        Siguiente: <span className="text-yellow-400 font-pixel">{nextNumber <= NUMBERS.length ? nextNumber : '✓'}</span>
                    </div>

                    {/* Progress */}
                    <div className="w-full max-w-md space-y-2">
                        {players.map(player => {
                            const prog = progress.get(player.id) || 0
                            const finished = finishTimes.has(player.id)
                            const time = finishTimes.get(player.id)

                            return (
                                <div key={player.id} className="flex items-center gap-3">
                                    <span className={clsx("text-sm w-24", player.id === winner && "text-yellow-400")}>
                                        {player.username}
                                    </span>
                                    <div className="flex-1 h-4 bg-white/20 rounded-full overflow-hidden">
                                        <motion.div
                                            animate={{ width: `${(prog / NUMBERS.length) * 100}%` }}
                                            className={clsx("h-full rounded-full", finished ? "bg-green-500" : "bg-cyan-500")}
                                        />
                                    </div>
                                    {finished && <span className="text-green-400 text-sm">{((time || 0) / 1000).toFixed(2)}s</span>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🔢</div>
                        <div className="text-4xl font-pixel text-cyan-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                        <div className="text-xl text-white/70 mt-2">
                            Tiempo: {((finishTimes.get(winner) || 0) / 1000).toFixed(2)}s
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default NumberOrder
