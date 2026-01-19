/**
 * ColorMatch - Stroop Effect Color Game
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playFail, playWinFanfare } from '../HighNoon/sounds'

interface ColorConfig {
    name: string
    displayName: string
    bgColor: string
    textColor: string
}

const COLORS: ColorConfig[] = [
    { name: 'red', displayName: 'RED', bgColor: 'bg-red-600', textColor: 'text-red-600' },
    { name: 'blue', displayName: 'BLUE', bgColor: 'bg-blue-600', textColor: 'text-blue-600' },
    { name: 'green', displayName: 'GREEN', bgColor: 'bg-green-600', textColor: 'text-green-600' },
    { name: 'yellow', displayName: 'YELLOW', bgColor: 'bg-yellow-500', textColor: 'text-yellow-500' },
]

const TOTAL_ROUNDS = 5

interface ColorMatchState {
    round: number
    targetColor: ColorConfig | null
    displayColor: ColorConfig | null
    scores: Map<string, number>
    roundWinner: string | null
    hasAnswered: boolean
    feedback: 'correct' | 'wrong' | null
}

const ColorMatch = () => {
    const engine = useMinigameEngine<ColorMatchState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            round: 0,
            targetColor: null,
            displayColor: null,
            scores: new Map(),
            roundWinner: null,
            hasAnswered: false,
            feedback: null
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

    // Initialize scores when players are available
    useEffect(() => {
        if (players.length > 0 && gameState.scores.size === 0) {
            updateGameState(state => ({
                ...state,
                scores: new Map(players.map(p => [p.id, 0]))
            }))
        }
    }, [players, gameState.scores.size, updateGameState])

    // Start first round when game begins
    useEffect(() => {
        if (isPlaying && gameState.round === 0 && !gameState.targetColor) {
            startNewRound()
        }
    }, [isPlaying, gameState.round, gameState.targetColor])

    const startNewRound = useCallback(() => {
        const newRound = gameState.round + 1

        if (newRound > TOTAL_ROUNDS) {
            if (gameEndedRef.current) return
            gameEndedRef.current = true

            const sortedScores = Array.from(gameState.scores.entries())
                .sort(([, a], [, b]) => b - a)
            const topWinner = sortedScores[0]?.[0] || null

            playWinFanfare()
            endGame(topWinner, sortedScores.map(([playerId, score], idx) => ({
                playerId, score, rank: idx + 1
            })))
            return
        }

        const target = COLORS[Math.floor(Math.random() * COLORS.length)]
        const display = COLORS[Math.floor(Math.random() * COLORS.length)]

        updateGameState(() => ({
            round: newRound,
            targetColor: target,
            displayColor: display,
            roundWinner: null,
            hasAnswered: false,
            feedback: null,
            scores: gameState.scores
        }))
    }, [gameState.round, gameState.scores, updateGameState, endGame])

    const handleColorClick = useCallback((color: ColorConfig) => {
        if (!currentPlayerId || !isPlaying || !gameState.targetColor ||
            gameState.hasAnswered || gameState.roundWinner || winnerId) return

        const isCorrect = color.name === gameState.targetColor.name

        if (isCorrect) {
            playTap()
            updateGameState(state => ({
                ...state,
                hasAnswered: true,
                feedback: 'correct',
                roundWinner: currentPlayerId,
                scores: new Map([...state.scores, [currentPlayerId, (state.scores.get(currentPlayerId) || 0) + 1]])
            }))
            setTimeout(startNewRound, 1500)
        } else {
            playFail()
            updateGameState(state => ({
                ...state,
                hasAnswered: true,
                feedback: 'wrong'
            }))
        }
    }, [currentPlayerId, isPlaying, gameState, winnerId, updateGameState, startNewRound])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-gray-900 to-black"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4">
                <div className="text-center pt-4">
                    <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2"
                        style={{ textShadow: '0 0 15px #00FFFF' }}>
                        COLOR MATCH!
                    </h1>
                    {isPlaying && (
                        <div className="text-lg text-white/70">
                            Round {gameState.round} / {TOTAL_ROUNDS}
                        </div>
                    )}
                </div>

                {isPlaying && gameState.targetColor && gameState.displayColor && (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="text-lg text-white/50 mb-4">TAP THE COLOR:</div>
                        <motion.div
                            key={gameState.round}
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className={clsx("text-6xl md:text-8xl font-pixel", gameState.displayColor.textColor)}
                            style={{ textShadow: '0 4px 0 #000' }}
                        >
                            {gameState.targetColor.displayName}
                        </motion.div>

                        {gameState.roundWinner && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-4 text-xl text-atari-green"
                            >
                                {players.find(p => p.id === gameState.roundWinner)?.username} got it!
                            </motion.div>
                        )}

                        {gameState.feedback && (
                            <motion.div
                                initial={{ scale: 1.5 }}
                                animate={{ scale: 1 }}
                                className={clsx(
                                    "mt-4 text-2xl font-pixel",
                                    gameState.feedback === 'correct' ? "text-green-400" : "text-red-400"
                                )}
                            >
                                {gameState.feedback === 'correct' ? '✓ CORRECT!' : '✗ WRONG!'}
                            </motion.div>
                        )}
                    </div>
                )}

                {isPlaying && (
                    <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-4">
                        {COLORS.map((color) => (
                            <motion.button
                                key={color.name}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleColorClick(color)}
                                disabled={gameState.hasAnswered || !!gameState.roundWinner}
                                className={clsx(
                                    "h-20 md:h-24 rounded-lg font-pixel text-xl text-white transition-all",
                                    color.bgColor,
                                    (gameState.hasAnswered || gameState.roundWinner) && "opacity-50 cursor-not-allowed"
                                )}
                                style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.5)' }}
                            >
                                {color.displayName}
                            </motion.button>
                        ))}
                    </div>
                )}

                <div className="w-full max-w-md">
                    <div className="flex justify-center gap-4 pb-4">
                        {players.map(player => (
                            <div key={player.id} className={clsx(
                                "text-center px-4 py-2 rounded-lg",
                                player.id === currentPlayerId ? "bg-atari-green/20 border border-atari-green" : "bg-white/10"
                            )}>
                                <div className="text-sm text-white/70">{player.username}</div>
                                <div className="text-2xl font-pixel text-atari-cyan">
                                    {gameState.scores.get(player.id) || 0}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default ColorMatch
