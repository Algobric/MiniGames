import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { useFairTiming } from '../../../hooks/useFairTiming'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'TYPING' | 'ENDED'

const PHRASES = [
    "El pingüino vuela de noche",
    "Gatos verdes en el tejado",
    "La pizza es vida eterna",
    "Código limpio siempre gana",
    "Abracadabra patas de cabra",
    "Los robots sueñan con ovejas",
    "Llueve café en el desierto",
    "Mariposas de metal azul",
    "Dinosaurios con sombreros",
    "El wifi es magia moderna"
]

const TypeRace: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()
    const { getServerTimestamp } = useFairTiming()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [targetPhrase, setTargetPhrase] = useState('')
    const [typedText, setTypedText] = useState('')
    const [progress, setProgress] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [startTime, setStartTime] = useState(0)
    const [winner, setWinner] = useState<string | null>(null)
    const [finishTimes, setFinishTimes] = useState<Map<string, number>>(new Map())

    const inputRef = useRef<HTMLInputElement>(null)
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
                        const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)]
                        const now = Date.now()
                        broadcastAndApply({ type: 'TYPE_START', phrase, startTime: now })
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

        if (lastBroadcast.type === 'TYPE_START') {
            setTargetPhrase(lastBroadcast.phrase)
            setStartTime(lastBroadcast.startTime)
            setPhase('TYPING')
            setTimeout(() => inputRef.current?.focus(), 100)
        }

        if (lastBroadcast.type === 'TYPE_PROGRESS') {
            setProgress(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.progress)
                return next
            })
        }

        if (lastBroadcast.type === 'TYPE_FINISH') {
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

        if (lastBroadcast.type === 'TYPE_GAME_OVER') {
            setPhase('ENDED')
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, winner, isHost, onGameEnd])

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (phase !== 'TYPING' || !currentPlayer || finishTimes.has(currentPlayer.id)) return

        const newText = e.target.value
        setTypedText(newText)

        // Calculate progress (percentage of characters correct)
        let correct = 0
        for (let i = 0; i < newText.length && i < targetPhrase.length; i++) {
            if (newText[i] === targetPhrase[i]) correct++
            else break // Stop at first mistake
        }

        const progressPct = Math.round((correct / targetPhrase.length) * 100)
        broadcastAndApply({ type: 'TYPE_PROGRESS', playerId: currentPlayer.id, progress: progressPct })

        // Check if finished
        if (newText === targetPhrase) {
            const finishTime = getServerTimestamp() - startTime
            playTap()
            broadcastAndApply({ type: 'TYPE_FINISH', playerId: currentPlayer.id, time: finishTime })

            if (isHost) {
                setTimeout(() => broadcastAndApply({ type: 'TYPE_GAME_OVER', winnerId: currentPlayer.id }), 2000)
            }
        }
    }, [phase, currentPlayer, targetPhrase, startTime, finishTimes, getServerTimestamp, isHost, broadcastAndApply])

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-indigo-900 to-purple-950 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>⌨️ CARRERA DE TIPEO!</h1>
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && (
                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
                    {/* Target phrase */}
                    <div className="text-center mb-6 p-4 bg-white/10 rounded-lg">
                        <div className="text-sm text-white/50 mb-2">Escribe esto:</div>
                        <div className="text-2xl text-white font-mono">
                            {targetPhrase.split('').map((char, i) => {
                                const typed = typedText[i]
                                const isCorrect = typed === char
                                const isTyped = i < typedText.length

                                return (
                                    <span
                                        key={i}
                                        className={clsx(
                                            isTyped && isCorrect && "text-green-400",
                                            isTyped && !isCorrect && "text-red-400 bg-red-900/50",
                                            !isTyped && "text-white/70"
                                        )}
                                    >
                                        {char}
                                    </span>
                                )
                            })}
                        </div>
                    </div>

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={typedText}
                        onChange={handleInputChange}
                        disabled={phase !== 'TYPING' || finishTimes.has(currentPlayer?.id || '')}
                        className="w-full px-4 py-3 text-xl font-mono bg-white/20 border-2 border-white/30 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                        placeholder="Empieza a escribir..."
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                    />

                    {/* Progress bars */}
                    <div className="w-full mt-6 space-y-3">
                        {players.map(player => {
                            const prog = progress.get(player.id) || 0
                            const finished = finishTimes.has(player.id)
                            const time = finishTimes.get(player.id)

                            return (
                                <div key={player.id}>
                                    <div className="flex justify-between text-sm text-white mb-1">
                                        <span className={player.id === winner ? "text-yellow-400" : ""}>
                                            {player.username} {finished && `✓ ${((time || 0) / 1000).toFixed(2)}s`}
                                        </span>
                                        <span>{prog}%</span>
                                    </div>
                                    <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                                        <motion.div
                                            animate={{ width: `${prog}%` }}
                                            className={clsx(
                                                "h-full rounded-full",
                                                player.id === currentPlayer?.id ? "bg-cyan-500" : "bg-pink-500",
                                                finished && "bg-green-500"
                                            )}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">⌨️</div>
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

export default TypeRace
