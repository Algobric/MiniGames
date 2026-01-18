import { useEffect, useState, useCallback } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'CHOOSING' | 'REVEAL' | 'ENDED'
type Choice = 'rock' | 'paper' | 'scissors' | null

const CHOICES: { id: Choice; emoji: string; beats: Choice }[] = [
    { id: 'rock', emoji: '✊', beats: 'scissors' },
    { id: 'paper', emoji: '✋', beats: 'rock' },
    { id: 'scissors', emoji: '✌️', beats: 'paper' }
]

const TOTAL_ROUNDS = 5

const RockPaperScissors: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [round, setRound] = useState(0)
    const [myChoice, setMyChoice] = useState<Choice>(null)
    const [choices, setChoices] = useState<Map<string, Choice>>(new Map())
    const [scores, setScores] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [roundResult, setRoundResult] = useState<string | null>(null)
    const [winner, setWinner] = useState<string | null>(null)
    const [chooseCountdown, setChooseCountdown] = useState(5)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false

    // Unlock audio
    useEffect(() => {
        const handleInteraction = () => {
            unlockAudio()
            window.removeEventListener('pointerdown', handleInteraction)
        }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    // Initial countdown
    useEffect(() => {
        if (phase !== 'COUNTDOWN') return
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    playCountdownBeep(true)
                    if (isHost) startNewRound()
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase, isHost])

    // Choosing countdown
    useEffect(() => {
        if (phase !== 'CHOOSING') return
        const interval = setInterval(() => {
            setChooseCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    // If player didn't choose, auto-select random
                    if (!myChoice && currentPlayer) {
                        const randomChoice = CHOICES[Math.floor(Math.random() * 3)].id
                        handleChoice(randomChoice!)
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase, myChoice, currentPlayer])

    const startNewRound = useCallback(() => {
        const newRound = round + 1
        if (newRound > TOTAL_ROUNDS) {
            const sortedScores = [...scores.entries()].sort((a, b) => b[1] - a[1])
            const winnerId = sortedScores[0]?.[0]
            broadcastAndApply({ type: 'RPS_GAME_OVER', winnerId })
            return
        }
        broadcastAndApply({ type: 'RPS_NEW_ROUND', round: newRound })
    }, [round, scores, broadcastAndApply])

    const handleChoice = useCallback((choice: Choice) => {
        if (phase !== 'CHOOSING' || !currentPlayer || myChoice) return

        setMyChoice(choice)
        playTap()
        broadcastAndApply({
            type: 'RPS_CHOOSE',
            playerId: currentPlayer.id,
            choice
        })
    }, [phase, currentPlayer, myChoice, broadcastAndApply])

    // Listen for broadcasts
    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'RPS_NEW_ROUND') {
            setRound(lastBroadcast.round)
            setPhase('CHOOSING')
            setMyChoice(null)
            setChoices(new Map())
            setRoundResult(null)
            setChooseCountdown(5)
        }

        if (lastBroadcast.type === 'RPS_CHOOSE') {
            setChoices(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.choice)

                // If all players have chosen, reveal
                if (next.size === players.length && isHost) {
                    setTimeout(() => {
                        broadcastAndApply({ type: 'RPS_REVEAL', choices: Object.fromEntries(next) })
                    }, 500)
                }
                return next
            })
        }

        if (lastBroadcast.type === 'RPS_REVEAL') {
            setPhase('REVEAL')
            const allChoices = new Map<string, Choice>(Object.entries(lastBroadcast.choices) as [string, Choice][])
            setChoices(allChoices)

            // Determine winner (for 2 players)
            const playerIds = [...allChoices.keys()]
            if (playerIds.length === 2) {
                const [p1, p2] = playerIds
                const c1 = allChoices.get(p1)
                const c2 = allChoices.get(p2)

                const choice1 = CHOICES.find(c => c.id === c1)

                if (c1 === c2) {
                    setRoundResult('TIE!')
                } else if (choice1?.beats === c2) {
                    setRoundResult(`${players.find(p => p.id === p1)?.username} wins round!`)
                    setScores(prev => {
                        const next = new Map(prev)
                        next.set(p1, (prev.get(p1) || 0) + 1)
                        return next
                    })
                    playWinFanfare()
                } else {
                    setRoundResult(`${players.find(p => p.id === p2)?.username} wins round!`)
                    setScores(prev => {
                        const next = new Map(prev)
                        next.set(p2, (prev.get(p2) || 0) + 1)
                        return next
                    })
                    if (p2 === currentPlayer?.id) playWinFanfare()
                    else playFail()
                }
            }

            if (isHost) {
                setTimeout(() => startNewRound(), 2500)
            }
        }

        if (lastBroadcast.type === 'RPS_GAME_OVER') {
            setPhase('ENDED')
            setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, players, isHost, currentPlayer?.id, startNewRound, onGameEnd, broadcastAndApply])

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-purple-900 to-black select-none p-4">
            {/* Header */}
            <div className="text-center pt-4">
                <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2" style={{ textShadow: '0 0 15px #FF00FF' }}>
                    ✊ ROCK PAPER SCISSORS!
                </h1>
                {phase !== 'COUNTDOWN' && phase !== 'ENDED' && (
                    <div className="text-lg text-white/70">Round {round} / {TOTAL_ROUNDS}</div>
                )}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">
                    {countdown}
                </motion.div>
            )}

            {/* Choice area */}
            <div className="flex-1 flex flex-col items-center justify-center">
                {phase === 'CHOOSING' && (
                    <>
                        <div className="text-2xl text-yellow-400 mb-6">
                            Choose in {chooseCountdown}...
                        </div>
                        <div className="flex gap-4">
                            {CHOICES.map(choice => (
                                <motion.button
                                    key={choice.id}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleChoice(choice.id)}
                                    disabled={!!myChoice}
                                    className={clsx(
                                        "w-24 h-24 md:w-32 md:h-32 rounded-xl text-5xl md:text-6xl transition-all",
                                        myChoice === choice.id
                                            ? "bg-green-600 border-4 border-green-400"
                                            : myChoice
                                                ? "bg-gray-700 opacity-50"
                                                : "bg-purple-700 hover:bg-purple-600"
                                    )}
                                >
                                    {choice.emoji}
                                </motion.button>
                            ))}
                        </div>
                        {myChoice && (
                            <div className="mt-4 text-green-400">Waiting for opponent...</div>
                        )}
                    </>
                )}

                {phase === 'REVEAL' && (
                    <div className="text-center">
                        <div className="flex gap-8 mb-6">
                            {players.map(player => {
                                const choice = choices.get(player.id)
                                const choiceData = CHOICES.find(c => c.id === choice)
                                return (
                                    <motion.div
                                        key={player.id}
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        className="text-center"
                                    >
                                        <div className="text-sm text-white/70 mb-2">{player.username}</div>
                                        <div className="text-6xl md:text-8xl">{choiceData?.emoji || '❓'}</div>
                                    </motion.div>
                                )
                            })}
                        </div>
                        {roundResult && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-2xl font-pixel text-yellow-400"
                            >
                                {roundResult}
                            </motion.div>
                        )}
                    </div>
                )}
            </div>

            {/* Scores */}
            <div className="flex gap-4 pb-4">
                {players.map(player => (
                    <div
                        key={player.id}
                        className={clsx(
                            "text-center px-4 py-2 rounded-lg",
                            player.id === currentPlayer?.id ? "bg-purple-700 border border-purple-400" : "bg-white/10"
                        )}
                    >
                        <div className="text-sm text-white/70">{player.username}</div>
                        <div className="text-2xl font-pixel text-pink-400">{scores.get(player.id) || 0}</div>
                    </div>
                ))}
            </div>

            {/* Winner */}
            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🏆</div>
                        <div className="text-4xl font-pixel text-pink-400">
                            {players.find(p => p.id === winner)?.username} WINS!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default RockPaperScissors
