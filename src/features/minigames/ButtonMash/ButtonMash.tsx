/**
 * ButtonMash - Tap as fast as you can!
 * 
 * REFACTORED TO USE THE NEW GAME ENGINE.
 * No more host/guest distinction in game logic!
 */

import { useCallback, useRef, useEffect } from 'react'
import { useMinigameEngine, MinigameWrapper, PlayerScoreBar } from '../../../engine'
import { motion } from 'framer-motion'
import { playTap } from '../HighNoon/sounds'

const GAME_DURATION = 5000

interface TapCount {
    playerId: string
    count: number
}

interface ButtonMashState {
    tapCounts: TapCount[]  // Changed from Map to array
}

// Helper function
const getTapCount = (tapCounts: TapCount[], playerId: string) =>
    tapCounts.find(t => t.playerId === playerId)?.count || 0

const ButtonMash = () => {
    const engine = useMinigameEngine<ButtonMashState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            tapCounts: []
        },
        gameDuration: GAME_DURATION,
        gameReducer: (state, event) => {
            // Ensure tapCounts is array
            const tapCounts = Array.isArray(state.tapCounts) ? state.tapCounts : []

            if (event.type === 'MASH_TAP') {
                const tapCount = (event as any).count || 1
                const existingIdx = tapCounts.findIndex(t => t.playerId === event.senderId)

                let newCounts: TapCount[]
                if (existingIdx >= 0) {
                    newCounts = [...tapCounts]
                    newCounts[existingIdx] = {
                        playerId: event.senderId,
                        count: tapCounts[existingIdx].count + tapCount
                    }
                } else {
                    newCounts = [...tapCounts, { playerId: event.senderId, count: tapCount }]
                }
                return { ...state, tapCounts: newCounts }
            }
            return state
        }
    })

    const {
        phase,
        countdown,
        timeRemaining,
        gameState,
        winnerId,
        isPlaying,
        currentPlayerId,
        players,
        endGame,
        dispatchGameEvent,
        updateGameState
    } = engine

    // Safe access to tapCounts
    const tapCounts = Array.isArray(gameState.tapCounts) ? gameState.tapCounts : []

    const screenShakeRef = useRef(false)
    const myTapsRef = useRef(0)
    const gameEndedRef = useRef(false)

    // Initialize tap counts when players are available
    useEffect(() => {
        if (players.length > 0 && tapCounts.length === 0) {
            updateGameState(() => ({
                tapCounts: players.map(p => ({ playerId: p.id, count: 0 }))
            }))
        }
    }, [players, tapCounts.length, updateGameState])

    // Check if game should end
    useEffect(() => {
        // Only Leader ends game
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        if (isPlaying && timeRemaining !== null && timeRemaining <= 0 && !gameEndedRef.current) {
            gameEndedRef.current = true

            const sortedCounts = [...tapCounts].sort((a, b) => b.count - a.count)

            const topPlayer = sortedCounts[0]
            if (topPlayer) {
                endGame(topPlayer.playerId, sortedCounts.map((t, idx) => ({
                    playerId: t.playerId,
                    score: t.count,
                    rank: idx + 1
                })))
            }
        }
    }, [isPlaying, timeRemaining, tapCounts, endGame, players, currentPlayerId])

    const handleTap = useCallback(() => {
        if (!isPlaying || !currentPlayerId || winnerId) return

        myTapsRef.current++
        playTap()
        dispatchGameEvent('MASH_TAP', { count: 1 })

        screenShakeRef.current = true
        setTimeout(() => { screenShakeRef.current = false }, 50)
    }, [isPlaying, currentPlayerId, winnerId, dispatchGameEvent])

    const sortedPlayers = [...players].sort((a, b) =>
        getTapCount(tapCounts, b.id) - getTapCount(tapCounts, a.id)
    )

    const maxTaps = Math.max(...tapCounts.map(t => t.count), 1)

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-purple-900 to-black"
        >
            <motion.div
                animate={screenShakeRef.current ? { x: [0, -5, 5, -5, 5, 0] } : {}}
                transition={{ duration: 0.1 }}
                className="flex flex-col items-center justify-between w-full h-full p-4 cursor-pointer"
                onPointerDown={handleTap}
            >
                <div className="text-center pt-4">
                    <h1
                        className="text-3xl md:text-5xl font-pixel text-white mb-2"
                        style={{ textShadow: '0 0 20px #FF00FF' }}
                    >
                        BUTTON MASH!
                    </h1>

                    {isPlaying && timeRemaining !== null && (
                        <div className="text-4xl md:text-6xl font-pixel text-red-400">
                            {(timeRemaining / 1000).toFixed(1)}s
                        </div>
                    )}
                </div>

                <div className="flex-1 w-full max-w-2xl flex flex-col justify-center gap-4 py-4">
                    {sortedPlayers.map((player, idx) => {
                        const count = getTapCount(tapCounts, player.id)
                        const isMe = player.id === currentPlayerId

                        return (
                            <motion.div
                                key={player.id}
                                initial={{ x: -50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <PlayerScoreBar
                                    username={player.username}
                                    value={count}
                                    maxValue={maxTaps}
                                    isCurrentPlayer={isMe}
                                    color={isMe ? 'bg-atari-green' : 'bg-atari-pink'}
                                />
                            </motion.div>
                        )
                    })}
                </div>

                <div className="pb-8 text-center">
                    {isPlaying && (
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ repeat: Infinity, duration: 0.2 }}
                            className="text-2xl font-pixel text-white/70"
                        >
                            TAP ANYWHERE!
                        </motion.div>
                    )}

                    {phase === 'COUNTDOWN' && (
                        <div className="text-xl text-white/50">GET READY...</div>
                    )}
                </div>
            </motion.div>
        </MinigameWrapper>
    )
}

export default ButtonMash

