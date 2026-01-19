/**
 * ReactionRace - Click the target first!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare } from '../HighNoon/sounds'

const TOTAL_ROUNDS = 5

interface ReactionRaceState {
    round: number
    localPhase: 'WAITING' | 'REACT'
    targetAppearTime: number
    scores: Map<string, number>
    roundWinner: string | null
    hasClicked: boolean
    myReactionTime: number | null
}

const ReactionRace = () => {
    const engine = useMinigameEngine<ReactionRaceState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            round: 0,
            localPhase: 'WAITING',
            targetAppearTime: 0,
            scores: new Map(),
            roundWinner: null,
            hasClicked: false,
            myReactionTime: null
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

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const gameEndedRef = useRef(false)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

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
            localPhase: 'WAITING' as const,
            targetAppearTime: 0,
            roundWinner: null,
            hasClicked: false,
            myReactionTime: null,
            scores: gameState.scores
        }))

        const delay = 1500 + Math.random() * 3000
        timerRef.current = setTimeout(() => {
            playTap()
            updateGameState(state => ({
                ...state,
                localPhase: 'REACT' as const,
                targetAppearTime: Date.now()
            }))
        }, delay)
    }, [gameState.round, gameState.scores, updateGameState, endGame])

    const handleClick = useCallback(() => {
        if (gameState.localPhase !== 'REACT' || !currentPlayerId ||
            gameState.hasClicked || gameState.roundWinner || winnerId) return

        const reactionTime = Date.now() - gameState.targetAppearTime
        playTap()

        updateGameState(state => ({
            ...state,
            hasClicked: true,
            myReactionTime: reactionTime,
            roundWinner: currentPlayerId,
            scores: new Map([...state.scores, [currentPlayerId, (state.scores.get(currentPlayerId) || 0) + 1]])
        }))

        setTimeout(startNewRound, 2000)
    }, [gameState, currentPlayerId, winnerId, updateGameState, startNewRound])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-blue-900 to-black"
        >
            <div
                className="flex flex-col items-center justify-between w-full h-full p-4 cursor-pointer"
                onClick={handleClick}
            >
                <div className="text-center pt-4">
                    <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2"
                        style={{ textShadow: '0 0 15px #00F' }}>
                        ⚡ REACTION RACE!
                    </h1>
                    {isPlaying && (
                        <div className="text-lg text-white/70">
                            Round {gameState.round} / {TOTAL_ROUNDS}
                        </div>
                    )}
                </div>

                <div className="flex-1 flex items-center justify-center w-full">
                    {gameState.localPhase === 'WAITING' && isPlaying && (
                        <div className="text-2xl text-white/50 animate-pulse">WAIT FOR THE TARGET...</div>
                    )}

                    {gameState.localPhase === 'REACT' && isPlaying && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="relative">
                            {!gameState.roundWinner && (
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ repeat: Infinity, duration: 0.3 }}
                                    className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-red-500 flex items-center justify-center"
                                    style={{ boxShadow: '0 0 30px #FF0000' }}
                                >
                                    <span className="text-4xl md:text-6xl">👆</span>
                                </motion.div>
                            )}

                            {gameState.roundWinner && (
                                <div className="text-center">
                                    <div className="text-4xl mb-4">✅</div>
                                    <div className="text-2xl text-green-400">
                                        {players.find(p => p.id === gameState.roundWinner)?.username} got it!
                                    </div>
                                    {gameState.myReactionTime !== null && (
                                        <div className="text-lg text-cyan-400 mt-2">
                                            Your time: {gameState.myReactionTime}ms
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                <div className="flex gap-4 pb-4">
                    {players.map(player => (
                        <div
                            key={player.id}
                            className={clsx(
                                "text-center px-4 py-2 rounded-lg",
                                player.id === currentPlayerId ? "bg-blue-700 border border-blue-400" : "bg-white/10"
                            )}
                        >
                            <div className="text-sm text-white/70">{player.username}</div>
                            <div className="text-2xl font-pixel text-cyan-400">
                                {gameState.scores.get(player.id) || 0}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default ReactionRace
