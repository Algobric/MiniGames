/**
 * RockPaperScissors - Classic game!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare } from '../HighNoon/sounds'

type Choice = 'rock' | 'paper' | 'scissors' | null

const CHOICES: { id: Choice; emoji: string; beats: Choice }[] = [
    { id: 'rock', emoji: '✊', beats: 'scissors' },
    { id: 'paper', emoji: '✋', beats: 'rock' },
    { id: 'scissors', emoji: '✌️', beats: 'paper' }
]

const TOTAL_ROUNDS = 5

interface RPSState {
    round: number
    localPhase: 'CHOOSING' | 'REVEAL'
    myChoice: Choice
    choices: Map<string, Choice>
    scores: Map<string, number>
    roundResult: string | null
    chooseCountdown: number
}

const RockPaperScissors = () => {
    const engine = useMinigameEngine<RPSState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            round: 0,
            localPhase: 'CHOOSING',
            myChoice: null,
            choices: new Map(),
            scores: new Map(),
            roundResult: null,
            chooseCountdown: 5
        },
        gameReducer: (state, event) => {
            if (event.type === 'INIT_GAME') {
                const { playerIds } = event as any
                return {
                    ...state,
                    scores: new Map(playerIds.map((id: string) => [id, 0])),
                    round: 1,
                    localPhase: 'CHOOSING'
                }
            }
            if (event.type === 'NEW_ROUND') {
                return {
                    ...state,
                    round: state.round + 1,
                    localPhase: 'CHOOSING',
                    myChoice: null,
                    choices: new Map(),
                    roundResult: null,
                    chooseCountdown: 5
                }
            }
            if (event.type === 'SUBMIT_CHOICE') {
                const { choice } = event as any
                const newChoices = new Map(state.choices)
                newChoices.set(event.senderId, choice)
                return { ...state, choices: newChoices }
            }
            if (event.type === 'REVEAL_ROUND') {
                const { result, scores } = event as any
                const newScores = new Map(scores) as Map<string, number>
                return {
                    ...state,
                    localPhase: 'REVEAL',
                    roundResult: result,
                    scores: newScores
                }
            }
            if (event.type === 'TICK_COUNTDOWN') {
                return { ...state, chooseCountdown: state.chooseCountdown - 1 }
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
        endGame,
        dispatchGameEvent
    } = engine

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const submittedRef = useRef(false)

    // Initialize (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (players.length > 0 && gameState.scores.size === 0 && isPlaying && isLeader) {
            dispatchGameEvent('INIT_GAME', { playerIds: players.map(p => p.id) })
        }
    }, [players, gameState.scores.size, isPlaying, currentPlayerId, dispatchGameEvent])

    // Choosing countdown (Host managed ticks)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (gameState.localPhase !== 'CHOOSING' || !isPlaying || !isLeader || winnerId) return

        timerRef.current = setInterval(() => {
            if (gameState.chooseCountdown <= 1) {
                if (timerRef.current) clearInterval(timerRef.current)
            }
            dispatchGameEvent('TICK_COUNTDOWN', {})
        }, 1000)

        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [gameState.localPhase, isPlaying, currentPlayerId, gameState.chooseCountdown, winnerId, dispatchGameEvent])

    // Auto-Select random if time is up (Client side)
    useEffect(() => {
        if (gameState.localPhase === 'CHOOSING' && gameState.chooseCountdown === 0 && !submittedRef.current && isPlaying) {
            const randomChoice = CHOICES[Math.floor(Math.random() * 3)].id
            handleChoice(randomChoice)
        }
    }, [gameState.chooseCountdown, gameState.localPhase, isPlaying])

    // Host Checks for Round Completion
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader || !isPlaying || gameState.localPhase !== 'CHOOSING') return

        const allChose = players.every(p => gameState.choices.has(p.id))
        const timeUp = gameState.chooseCountdown === 0

        if (allChose || timeUp) {
            if (timeUp && !allChose) {
                return
            }

            if (allChose) {
                revealRound()
            }
        }
    }, [gameState.choices, gameState.chooseCountdown, gameState.localPhase, isPlaying, players, currentPlayerId]) // Added revealRound to deps via function ref or useCallback


    const revealRound = useCallback(() => {
        let roundResult = 'TIE!'
        const newScores = new Map(gameState.scores)

        const uniqueChoices = Array.from(new Set(gameState.choices.values()))

        let winners: string[] = []

        if (uniqueChoices.length === 1 || uniqueChoices.length === 3) {
            roundResult = "TIE!"
        } else if (uniqueChoices.length === 2 && uniqueChoices[0] && uniqueChoices[1]) {
            const [c1, c2] = uniqueChoices as Choice[]
            const c1Beats = CHOICES.find(c => c.id === c1)?.beats
            const winnerChoice = c1Beats === c2 ? c1 : c2

            players.forEach(p => {
                if (gameState.choices.get(p.id) === winnerChoice) {
                    newScores.set(p.id, (newScores.get(p.id) || 0) + 1)
                    winners.push(p.id)
                }
            })

            const winnerNames = players.filter(p => winners.includes(p.id)).map(p => p.username).join(', ')
            roundResult = `${winnerNames} win(s)!`
        }

        dispatchGameEvent('REVEAL_ROUND', { result: roundResult, scores: Array.from(newScores.entries()) })

        // Schedule Next Round
        setTimeout(() => {
            const nextRound = gameState.round + 1
            if (nextRound > TOTAL_ROUNDS) {
                // Game Over
                const sortedScores = Array.from(newScores.entries()).sort((a, b) => b[1] - a[1])
                const topWinner = sortedScores[0]?.[0]
                playWinFanfare()
                endGame(topWinner)
            } else {
                dispatchGameEvent('NEW_ROUND', {})
                // Reset submitted ref for new round locally for checking?
                // But we can't reset ref inside host logic easily for all clients.
                // Clients observe NEW_ROUND event via reducer?
                // No, clients need to reset THEIR submittedRef.
            }
        }, 3000)

    }, [gameState.scores, gameState.choices, gameState.round, players, dispatchGameEvent, endGame])

    // Reset submittedRef on new round
    useEffect(() => {
        if (gameState.localPhase === 'CHOOSING') {
            submittedRef.current = false
        }
    }, [gameState.round])


    const handleChoice = useCallback((choice: Choice) => {
        if (gameState.localPhase !== 'CHOOSING' || !currentPlayerId || submittedRef.current || winnerId) return

        playTap()
        submittedRef.current = true
        dispatchGameEvent('SUBMIT_CHOICE', { choice })

    }, [gameState.localPhase, currentPlayerId, winnerId, dispatchGameEvent])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-purple-900 to-black"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4">
                <div className="text-center pt-4">
                    <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2"
                        style={{ textShadow: '0 0 15px #FF00FF' }}>
                        ✊ ROCK PAPER SCISSORS!
                    </h1>
                    {isPlaying && (
                        <div className="text-lg text-white/70">Round {gameState.round} / {TOTAL_ROUNDS}</div>
                    )}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center">
                    {gameState.localPhase === 'CHOOSING' && isPlaying && (
                        <>
                            <div className="text-2xl text-yellow-400 mb-6">
                                Choose in {gameState.chooseCountdown}...
                            </div>
                            <div className="flex gap-4">
                                {CHOICES.map(choice => (
                                    <motion.button
                                        key={choice.id}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleChoice(choice.id)}
                                        // disabled if I have already chosen (checked via map or ref)
                                        disabled={submittedRef.current}
                                        className={clsx(
                                            "w-24 h-24 md:w-32 md:h-32 rounded-xl text-5xl md:text-6xl transition-all",
                                            // Highlight ONLY if we want to show selection? 
                                            // Usually secret until reveal.
                                            // Maybe show selection only to me?
                                            // Use local tracking or just don't show highlighting to keep it hidden?
                                            // The original code showed highlighting.
                                            // We can check gameState.choices for my ID
                                            gameState.choices.get(currentPlayerId || '') === choice.id
                                                ? "bg-green-600 border-4 border-green-400"
                                                : submittedRef.current
                                                    ? "bg-gray-700 opacity-50"
                                                    : "bg-purple-700 hover:bg-purple-600"
                                        )}
                                    >
                                        {choice.emoji}
                                    </motion.button>
                                ))}
                            </div>
                            {submittedRef.current && (
                                <div className="mt-4 text-green-400">Waiting for opponent...</div>
                            )}
                        </>
                    )}

                    {gameState.localPhase === 'REVEAL' && isPlaying && (
                        <div className="text-center">
                            <div className="flex gap-8 mb-6">
                                {players.map(player => {
                                    const choice = gameState.choices.get(player.id)
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
                            {gameState.roundResult && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="text-2xl font-pixel text-yellow-400"
                                >
                                    {gameState.roundResult}
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-4 pb-4">
                    {players.map(player => (
                        <div
                            key={player.id}
                            className={clsx(
                                "text-center px-4 py-2 rounded-lg",
                                player.id === currentPlayerId ? "bg-purple-700 border border-purple-400" : "bg-white/10"
                            )}
                        >
                            <div className="text-sm text-white/70">{player.username}</div>
                            <div className="text-2xl font-pixel text-pink-400">
                                {gameState.scores.get(player.id) || 0}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default RockPaperScissors
