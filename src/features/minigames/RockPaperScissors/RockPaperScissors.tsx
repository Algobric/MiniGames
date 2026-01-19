/**
 * RockPaperScissors - Classic game!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

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
        updateGameState
    } = engine

    const gameEndedRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Initialize scores
    useEffect(() => {
        if (players.length > 0 && gameState.scores.size === 0) {
            updateGameState(state => ({
                ...state,
                scores: new Map(players.map(p => [p.id, 0]))
            }))
        }
    }, [players, gameState.scores.size, updateGameState])

    // Start first round
    useEffect(() => {
        if (isPlaying && gameState.round === 0) {
            startNewRound()
        }
    }, [isPlaying, gameState.round])

    // Choosing countdown
    useEffect(() => {
        if (gameState.localPhase !== 'CHOOSING' || !isPlaying) return

        timerRef.current = setInterval(() => {
            updateGameState(state => {
                if (state.chooseCountdown <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current)
                    // Auto-select random if not chosen
                    if (!state.myChoice && currentPlayerId) {
                        const randomChoice = CHOICES[Math.floor(Math.random() * 3)].id
                        setTimeout(() => handleChoice(randomChoice!), 0)
                    }
                    return { ...state, chooseCountdown: 0 }
                }
                return { ...state, chooseCountdown: state.chooseCountdown - 1 }
            })
        }, 1000)

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [gameState.localPhase, isPlaying, currentPlayerId])

    const startNewRound = useCallback(() => {
        const newRound = gameState.round + 1

        if (newRound > TOTAL_ROUNDS) {
            if (gameEndedRef.current) return
            gameEndedRef.current = true

            const sortedScores = Array.from(gameState.scores.entries())
                .sort(([, a], [, b]) => b - a)
            const topWinner = sortedScores[0]?.[0] || null

            playWinFanfare()
            endGame(topWinner)
            return
        }

        updateGameState(() => ({
            round: newRound,
            localPhase: 'CHOOSING' as const,
            myChoice: null,
            choices: new Map(),
            roundResult: null,
            chooseCountdown: 5,
            scores: gameState.scores
        }))
    }, [gameState.round, gameState.scores, updateGameState, endGame])

    const handleChoice = useCallback((choice: Choice) => {
        if (gameState.localPhase !== 'CHOOSING' || !currentPlayerId || gameState.myChoice || winnerId) return

        playTap()
        updateGameState(state => {
            const newChoices = new Map([...state.choices, [currentPlayerId, choice]])

            // Check if all players chose
            if (newChoices.size === players.length) {
                setTimeout(() => revealChoices(newChoices), 500)
            }

            return { ...state, myChoice: choice, choices: newChoices }
        })
    }, [gameState.localPhase, gameState.myChoice, currentPlayerId, players.length, winnerId, updateGameState])

    const revealChoices = useCallback((allChoices: Map<string, Choice>) => {
        updateGameState(state => {
            const playerIds = [...allChoices.keys()]
            let roundResult = 'TIE!'
            let newScores = new Map(state.scores)

            if (playerIds.length === 2) {
                const [p1, p2] = playerIds
                const c1 = allChoices.get(p1)
                const c2 = allChoices.get(p2)
                const choice1 = CHOICES.find(c => c.id === c1)

                if (c1 !== c2) {
                    if (choice1?.beats === c2) {
                        roundResult = `${players.find(p => p.id === p1)?.username} wins round!`
                        newScores.set(p1, (newScores.get(p1) || 0) + 1)
                        if (p1 === currentPlayerId) playWinFanfare()
                        else playFail()
                    } else {
                        roundResult = `${players.find(p => p.id === p2)?.username} wins round!`
                        newScores.set(p2, (newScores.get(p2) || 0) + 1)
                        if (p2 === currentPlayerId) playWinFanfare()
                        else playFail()
                    }
                }
            }

            setTimeout(startNewRound, 2500)
            return { ...state, localPhase: 'REVEAL' as const, roundResult, scores: newScores }
        })
    }, [players, currentPlayerId, updateGameState, startNewRound])

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
                                        disabled={!!gameState.myChoice}
                                        className={clsx(
                                            "w-24 h-24 md:w-32 md:h-32 rounded-xl text-5xl md:text-6xl transition-all",
                                            gameState.myChoice === choice.id
                                                ? "bg-green-600 border-4 border-green-400"
                                                : gameState.myChoice
                                                    ? "bg-gray-700 opacity-50"
                                                    : "bg-purple-700 hover:bg-purple-600"
                                        )}
                                    >
                                        {choice.emoji}
                                    </motion.button>
                                ))}
                            </div>
                            {gameState.myChoice && (
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
