import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'SHOWING' | 'INPUT' | 'RESULT' | 'ENDED'


const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'] // Red, Cyan, Yellow, Mint
const BUTTON_LABELS = ['🔴', '🔵', '🟡', '🟢']
const STARTING_LENGTH = 3
const MAX_LENGTH = 10

const MemoryFlash: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [round, setRound] = useState(0)
    const [sequence, setSequence] = useState<number[]>([])
    const [showingIndex, setShowingIndex] = useState(-1)
    const [playerInput, setPlayerInput] = useState<number[]>([])
    const [alivePlayers, setAlivePlayers] = useState<Set<string>>(new Set(players.map(p => p.id)))
    const [roundResults, setRoundResults] = useState<Map<string, boolean>>(new Map())
    const [winner, setWinner] = useState<string | null>(null)
    const [flashButton, setFlashButton] = useState<number | null>(null)

    const inputRef = useRef<number[]>([])
    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const isAlive = currentPlayer ? alivePlayers.has(currentPlayer.id) : false

    // Reset ref on mount
    useEffect(() => {
        inputRef.current = []
    }, [])

    // Unlock audio
    useEffect(() => {
        const handleInteraction = () => {
            unlockAudio()
            window.removeEventListener('pointerdown', handleInteraction)
        }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    // Countdown
    useEffect(() => {
        if (phase !== 'COUNTDOWN') return

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [phase])

    // Start game after countdown
    useEffect(() => {
        if (countdown === 0 && phase === 'COUNTDOWN') {
            playCountdownBeep(true)

            if (isHost) {
                startNewRound(1, STARTING_LENGTH)
            }
        }
    }, [countdown, phase, isHost])

    const startNewRound = useCallback((roundNum: number, length: number) => {
        // Generate random sequence
        const newSequence: number[] = []
        for (let i = 0; i < length; i++) {
            newSequence.push(Math.floor(Math.random() * 4))
        }

        broadcastAndApply({
            type: 'MEMORY_NEW_ROUND',
            round: roundNum,
            sequence: newSequence
        })
    }, [broadcastAndApply])

    // Show sequence animation
    useEffect(() => {
        if (phase !== 'SHOWING' || sequence.length === 0) return

        let i = 0
        const showNext = () => {
            if (i < sequence.length) {
                setShowingIndex(i)
                playTap()
                setTimeout(() => {
                    setShowingIndex(-1)
                    i++
                    setTimeout(showNext, 300)
                }, 500)
            } else {
                // Done showing, time for input
                setPhase('INPUT')
                setPlayerInput([])
                inputRef.current = []
            }
        }

        const timeout = setTimeout(showNext, 500)
        return () => clearTimeout(timeout)
    }, [phase, sequence])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'MEMORY_NEW_ROUND') {
            setRound(lastBroadcast.round)
            setSequence(lastBroadcast.sequence)
            setPhase('SHOWING')
            setRoundResults(new Map())
            setPlayerInput([])
            inputRef.current = []
        }

        if (lastBroadcast.type === 'MEMORY_PLAYER_RESULT') {
            let nextRoundResults: Map<string, boolean> | null = null
            let nextAlivePlayers: Set<string> | null = null

            setRoundResults(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.correct)
                nextRoundResults = next
                return next
            })

            setAlivePlayers(prev => {
                const next = new Set(prev)
                if (!lastBroadcast.correct) {
                    next.delete(lastBroadcast.playerId)
                }
                nextAlivePlayers = next
                return next
            })

            // Host checks if round should end
            if (isHost && nextRoundResults && nextAlivePlayers) {
                // Check if all currently alive players have a success result
                // Or if everyone is dead
                const allAliveFinished = [...nextAlivePlayers].every(id => nextRoundResults?.get(id) === true)

                if (allAliveFinished || (nextAlivePlayers as Set<string>).size === 0) {
                    setTimeout(() => {
                        broadcastAndApply({
                            type: 'MEMORY_ROUND_END',
                            round: round,
                            alivePlayers: [...(nextAlivePlayers || [])]
                        })
                    }, 500)
                }
            }
        }

        if (lastBroadcast.type === 'MEMORY_ROUND_END') {
            setPhase('RESULT')

            // Check for game over conditions
            const alive = new Set<string>(lastBroadcast.alivePlayers)
            setAlivePlayers(alive)

            if (alive.size <= 1 || lastBroadcast.round >= MAX_LENGTH) {
                // Game over!
                const winnerId = alive.size === 1
                    ? [...alive][0]
                    : [...alive][0] // Tie goes to first

                setTimeout(() => {
                    broadcastAndApply({
                        type: 'MEMORY_GAME_OVER',
                        winnerId
                    })
                }, 1500)
            } else {
                // Next round
                if (isHost) {
                    setTimeout(() => {
                        startNewRound(lastBroadcast.round + 1, STARTING_LENGTH + lastBroadcast.round)
                    }, 2000)
                }
            }
        }

        if (lastBroadcast.type === 'MEMORY_GAME_OVER') {
            setWinner(lastBroadcast.winnerId)
            setPhase('ENDED')

            if (lastBroadcast.winnerId === currentPlayer?.id) {
                playWinFanfare()
            }

            if (isHost) {
                setTimeout(() => {
                    onGameEnd({ winnerId: lastBroadcast.winnerId })
                }, 3000)
            }
        }
    }, [lastBroadcast, isHost, currentPlayer?.id, startNewRound, onGameEnd, broadcastAndApply])

    // Handle button press
    const handleButtonPress = useCallback((buttonIndex: number) => {
        if (phase !== 'INPUT' || !currentPlayer || !isAlive) return

        playTap()
        setFlashButton(buttonIndex)
        setTimeout(() => setFlashButton(null), 100)

        inputRef.current = [...inputRef.current, buttonIndex]
        setPlayerInput([...inputRef.current])

        const currentPos = inputRef.current.length - 1
        const isCorrect = sequence[currentPos] === buttonIndex

        if (!isCorrect) {
            // Wrong! Player is out
            playFail()
            broadcastAndApply({
                type: 'MEMORY_PLAYER_RESULT',
                playerId: currentPlayer.id,
                correct: false
            })
        } else if (inputRef.current.length === sequence.length) {
            // Completed sequence correctly!
            broadcastAndApply({
                type: 'MEMORY_PLAYER_RESULT',
                playerId: currentPlayer.id,
                correct: true
            })
        }
    }, [phase, currentPlayer, isAlive, sequence, round, alivePlayers, roundResults, isHost, broadcastAndApply])

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-indigo-900 to-black select-none p-4">
            {/* Header */}
            <div className="text-center pt-4">
                <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2"
                    style={{ textShadow: '0 0 15px #FF00FF' }}>
                    MEMORY FLASH!
                </h1>

                {phase === 'COUNTDOWN' && (
                    <motion.div
                        key={countdown}
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-7xl md:text-8xl font-pixel text-atari-yellow mt-8"
                        style={{ textShadow: '0 0 30px #FFD700' }}
                    >
                        {countdown}
                    </motion.div>
                )}

                {phase !== 'COUNTDOWN' && phase !== 'ENDED' && (
                    <div className="text-lg text-white/70">
                        Round {round} - {sequence.length} colors
                    </div>
                )}

                {phase === 'SHOWING' && (
                    <div className="text-xl text-atari-cyan mt-4 animate-pulse">
                        WATCH THE SEQUENCE...
                    </div>
                )}

                {phase === 'INPUT' && isAlive && (
                    <div className="text-xl text-atari-green mt-4">
                        YOUR TURN! ({playerInput.length}/{sequence.length})
                    </div>
                )}

                {phase === 'INPUT' && !isAlive && (
                    <div className="text-xl text-red-400 mt-4">
                        YOU'RE OUT - WATCHING...
                    </div>
                )}
            </div>

            {/* Button grid */}
            <div className="flex-1 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 w-64 h-64 md:w-80 md:h-80">
                    {COLORS.map((color, idx) => (
                        <motion.button
                            key={idx}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleButtonPress(idx)}
                            disabled={phase !== 'INPUT' || !isAlive}
                            className={clsx(
                                "rounded-xl transition-all duration-100",
                                (phase !== 'INPUT' || !isAlive) && "cursor-not-allowed"
                            )}
                            style={{
                                backgroundColor: color,
                                opacity: showingIndex === idx || flashButton === idx ? 1 : 0.4,
                                boxShadow: showingIndex === idx || flashButton === idx
                                    ? `0 0 30px ${color}`
                                    : '0 4px 0 rgba(0,0,0,0.5)',
                                transform: showingIndex === idx ? 'scale(1.1)' : 'scale(1)'
                            }}
                        >
                            <span className="text-4xl">{BUTTON_LABELS[idx]}</span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Player status */}
            <div className="w-full max-w-md pb-4">
                <div className="flex flex-wrap justify-center gap-2">
                    {players.map(player => {
                        const alive = alivePlayers.has(player.id)
                        const result = roundResults.get(player.id)
                        const isMe = player.id === currentPlayer?.id

                        return (
                            <div
                                key={player.id}
                                className={clsx(
                                    "px-3 py-1 rounded-lg text-sm",
                                    !alive && "line-through opacity-50",
                                    isMe ? "border-2 border-atari-green" : "border border-white/20",
                                    result === true && "bg-green-800",
                                    result === false && "bg-red-800",
                                    result === undefined && alive && "bg-white/10"
                                )}
                            >
                                <span className="text-white">{player.username}</span>
                                {result === true && <span className="ml-1">✓</span>}
                                {result === false && <span className="ml-1">✗</span>}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Winner display */}
            <AnimatePresence>
                {phase === 'ENDED' && winner && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center bg-black/80"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-center"
                        >
                            <div className="text-6xl mb-4">🧠</div>
                            <div className="text-4xl font-pixel text-atari-green">
                                {players.find(p => p.id === winner)?.username} WINS!
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default MemoryFlash
