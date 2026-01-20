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

interface PlayerScore {
    playerId: string
    score: number
}

interface ReactionRaceState {
    round: number
    localPhase: 'WAITING' | 'REACT'
    targetAppearTime: number
    scores: PlayerScore[]  // Changed from Map to array
    roundWinner: string | null
    hasClicked: boolean
    myReactionTime: number | null
}

// Helper function to get score
const getScore = (scores: PlayerScore[], playerId: string) =>
    scores.find(s => s.playerId === playerId)?.score || 0

const ReactionRace = () => {
    const engine = useMinigameEngine<ReactionRaceState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            round: 0,
            localPhase: 'WAITING',
            targetAppearTime: 0,
            scores: [],  // Empty array instead of Map
            roundWinner: null,
            hasClicked: false,
            myReactionTime: null
        },
        gameReducer: (state, event) => {
            // Ensure scores is array (in case of sync issues)
            const scores = Array.isArray(state.scores) ? state.scores : []

            if (event.type === 'TARGET_SPAWN') {
                const { timestamp } = event as any
                return {
                    ...state,
                    localPhase: 'REACT',
                    targetAppearTime: timestamp
                }
            }
            if (event.type === 'TAP_TARGET') {
                if (state.roundWinner) return state // Already won

                // Update scores using array
                const existingIdx = scores.findIndex(s => s.playerId === event.senderId)
                let newScores: PlayerScore[]
                if (existingIdx >= 0) {
                    newScores = [...scores]
                    newScores[existingIdx] = {
                        playerId: event.senderId,
                        score: scores[existingIdx].score + 1
                    }
                } else {
                    newScores = [...scores, { playerId: event.senderId, score: 1 }]
                }

                return {
                    ...state,
                    roundWinner: event.senderId,
                    scores: newScores
                }
            }
            if (event.type === 'NEW_ROUND') {
                const { round } = event as any
                return {
                    ...state,
                    round,
                    localPhase: 'WAITING',
                    targetAppearTime: 0,
                    roundWinner: null,
                    hasClicked: false,
                    myReactionTime: null
                }
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
        dispatchGameEvent,
        updateGameState
    } = engine

    // Safe access to scores array
    const scores = Array.isArray(gameState.scores) ? gameState.scores : []

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const gameEndedRef = useRef(false)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    // Initialize scores when players are available
    useEffect(() => {
        if (players.length > 0 && scores.length === 0) {
            updateGameState(state => ({
                ...state,
                scores: players.map(p => ({ playerId: p.id, score: 0 }))
            }))
        }
    }, [players, scores.length, updateGameState])

    // Start first round (Host Only)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (isPlaying && gameState.round === 0 && isLeader) {
            startHostRound()
        }
    }, [isPlaying, gameState.round, players, currentPlayerId])

    // Host Round Logic
    const startHostRound = useCallback(() => {
        const newRound = gameState.round + 1

        if (newRound > TOTAL_ROUNDS) {
            // Check Game End logic triggers in effect
            dispatchGameEvent('SYSTEM_GAME_END_CHECK', {})
            return
        }

        dispatchGameEvent('NEW_ROUND', { round: newRound })

        const delay = 1500 + Math.random() * 3000
        timerRef.current = setTimeout(() => {
            dispatchGameEvent('TARGET_SPAWN', { timestamp: Date.now() })
        }, delay)

    }, [gameState.round, dispatchGameEvent])

    // Host Handle Round Win -> Next Round
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        if (gameState.roundWinner) {
            const timer = setTimeout(() => {
                startHostRound()
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [gameState.roundWinner, startHostRound, players, currentPlayerId])

    // Game End Check
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        if (gameState.round > TOTAL_ROUNDS && !gameEndedRef.current) {
            gameEndedRef.current = true
            const sortedScores = [...scores].sort((a, b) => b.score - a.score)
            const topWinner = sortedScores[0]?.playerId || null
            playWinFanfare()
            endGame(topWinner)
        }
    }, [gameState.round, scores, endGame, players, currentPlayerId])


    const handleClick = useCallback(() => {
        if (gameState.localPhase !== 'REACT' || !currentPlayerId ||
            gameState.hasClicked || gameState.roundWinner || winnerId) return

        const reactionTime = Date.now() - gameState.targetAppearTime
        playTap()

        // Optimistic local update (optional, mainly for 'hasClicked' UI)
        updateGameState(state => ({ ...state, hasClicked: true, myReactionTime: reactionTime }))

        dispatchGameEvent('TAP_TARGET', { timestamp: Date.now() })

    }, [gameState, currentPlayerId, winnerId, updateGameState, dispatchGameEvent])

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
                                {getScore(scores, player.id)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default ReactionRace

