/**
 * MemoryFlash - Remember the sequence!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useEffect, useCallback, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playFail, playWinFanfare } from '../HighNoon/sounds'

const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3']
const BUTTON_LABELS = ['🔴', '🔵', '🟡', '🟢']
const STARTING_LENGTH = 3
const MAX_LENGTH = 10

interface MemoryFlashState {
    round: number
    sequence: number[]
    showingIndex: number
    playerInput: number[]
    alivePlayers: Set<string>
    roundResults: Map<string, boolean>
    localPhase: 'SHOWING' | 'INPUT' | 'RESULT'
    flashButton: number | null
}

const MemoryFlash = () => {
    const engine = useMinigameEngine<MemoryFlashState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            round: 0,
            sequence: [],
            showingIndex: -1,
            playerInput: [],
            alivePlayers: new Set(),
            roundResults: new Map(),
            localPhase: 'SHOWING',
            flashButton: null
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

    const inputRef = useRef<number[]>([])
    const gameEndedRef = useRef(false)
    const isAlive = currentPlayerId ? gameState.alivePlayers.has(currentPlayerId) : false

    // Initialize alive players
    useEffect(() => {
        if (players.length > 0 && gameState.alivePlayers.size === 0) {
            updateGameState(state => ({
                ...state,
                alivePlayers: new Set(players.map(p => p.id))
            }))
        }
    }, [players, gameState.alivePlayers.size, updateGameState])

    // Start first round
    useEffect(() => {
        if (isPlaying && gameState.round === 0 && gameState.sequence.length === 0) {
            startNewRound(1, STARTING_LENGTH)
        }
    }, [isPlaying, gameState.round, gameState.sequence.length])

    const startNewRound = useCallback((roundNum: number, length: number) => {
        const newSequence: number[] = []
        for (let i = 0; i < length; i++) {
            newSequence.push(Math.floor(Math.random() * 4))
        }

        inputRef.current = []
        updateGameState(() => ({
            round: roundNum,
            sequence: newSequence,
            showingIndex: -1,
            playerInput: [],
            roundResults: new Map(),
            localPhase: 'SHOWING' as const,
            flashButton: null,
            alivePlayers: gameState.alivePlayers
        }))
    }, [gameState.alivePlayers, updateGameState])

    // Show sequence animation
    useEffect(() => {
        if (gameState.localPhase !== 'SHOWING' || gameState.sequence.length === 0 || !isPlaying) return

        let i = 0
        const showNext = () => {
            if (i < gameState.sequence.length) {
                updateGameState(state => ({ ...state, showingIndex: i }))
                playTap()
                setTimeout(() => {
                    updateGameState(state => ({ ...state, showingIndex: -1 }))
                    i++
                    setTimeout(showNext, 300)
                }, 500)
            } else {
                inputRef.current = []
                updateGameState(state => ({
                    ...state,
                    localPhase: 'INPUT' as const,
                    playerInput: []
                }))
            }
        }

        const timeout = setTimeout(showNext, 500)
        return () => clearTimeout(timeout)
    }, [gameState.localPhase, gameState.sequence, isPlaying, updateGameState])

    const handleButtonPress = useCallback((buttonIndex: number) => {
        if (gameState.localPhase !== 'INPUT' || !currentPlayerId || !isAlive || winnerId) return

        playTap()
        updateGameState(state => ({ ...state, flashButton: buttonIndex }))
        setTimeout(() => updateGameState(state => ({ ...state, flashButton: null })), 100)

        inputRef.current = [...inputRef.current, buttonIndex]
        const currentPos = inputRef.current.length - 1
        const isCorrect = gameState.sequence[currentPos] === buttonIndex

        updateGameState(state => ({ ...state, playerInput: [...inputRef.current] }))

        if (!isCorrect) {
            playFail()
            updateGameState(state => ({
                ...state,
                alivePlayers: new Set([...state.alivePlayers].filter(id => id !== currentPlayerId)),
                roundResults: new Map([...state.roundResults, [currentPlayerId, false]])
            }))
            checkRoundEnd()
        } else if (inputRef.current.length === gameState.sequence.length) {
            updateGameState(state => ({
                ...state,
                roundResults: new Map([...state.roundResults, [currentPlayerId, true]])
            }))
            checkRoundEnd()
        }
    }, [gameState, currentPlayerId, isAlive, winnerId, updateGameState])

    const checkRoundEnd = useCallback(() => {
        setTimeout(() => {
            const alive = gameState.alivePlayers

            if (alive.size <= 1 || gameState.round >= MAX_LENGTH) {
                if (gameEndedRef.current) return
                gameEndedRef.current = true

                const winner = alive.size >= 1 ? [...alive][0] : null
                playWinFanfare()
                endGame(winner)
            } else {
                updateGameState(state => ({ ...state, localPhase: 'RESULT' as const }))
                setTimeout(() => {
                    startNewRound(gameState.round + 1, STARTING_LENGTH + gameState.round)
                }, 2000)
            }
        }, 500)
    }, [gameState.alivePlayers, gameState.round, updateGameState, startNewRound, endGame])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-indigo-900 to-black"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4">
                <div className="text-center pt-4">
                    <h1 className="text-3xl md:text-4xl font-pixel text-white mb-2"
                        style={{ textShadow: '0 0 15px #FF00FF' }}>
                        MEMORY FLASH!
                    </h1>

                    {isPlaying && (
                        <div className="text-lg text-white/70">
                            Round {gameState.round} - {gameState.sequence.length} colors
                        </div>
                    )}

                    {gameState.localPhase === 'SHOWING' && isPlaying && (
                        <div className="text-xl text-atari-cyan mt-4 animate-pulse">WATCH THE SEQUENCE...</div>
                    )}

                    {gameState.localPhase === 'INPUT' && isAlive && isPlaying && (
                        <div className="text-xl text-atari-green mt-4">
                            YOUR TURN! ({gameState.playerInput.length}/{gameState.sequence.length})
                        </div>
                    )}

                    {gameState.localPhase === 'INPUT' && !isAlive && isPlaying && (
                        <div className="text-xl text-red-400 mt-4">YOU'RE OUT - WATCHING...</div>
                    )}
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-4 w-64 h-64 md:w-80 md:h-80">
                        {COLORS.map((color, idx) => (
                            <motion.button
                                key={idx}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleButtonPress(idx)}
                                disabled={gameState.localPhase !== 'INPUT' || !isAlive}
                                className={clsx(
                                    "rounded-xl transition-all duration-100",
                                    (gameState.localPhase !== 'INPUT' || !isAlive) && "cursor-not-allowed"
                                )}
                                style={{
                                    backgroundColor: color,
                                    opacity: gameState.showingIndex === idx || gameState.flashButton === idx ? 1 : 0.4,
                                    boxShadow: gameState.showingIndex === idx || gameState.flashButton === idx
                                        ? `0 0 30px ${color}`
                                        : '0 4px 0 rgba(0,0,0,0.5)',
                                    transform: gameState.showingIndex === idx ? 'scale(1.1)' : 'scale(1)'
                                }}
                            >
                                <span className="text-4xl">{BUTTON_LABELS[idx]}</span>
                            </motion.button>
                        ))}
                    </div>
                </div>

                <div className="w-full max-w-md pb-4">
                    <div className="flex flex-wrap justify-center gap-2">
                        {players.map(player => {
                            const alive = gameState.alivePlayers.has(player.id)
                            const result = gameState.roundResults.get(player.id)
                            const isMe = player.id === currentPlayerId

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
            </div>
        </MinigameWrapper>
    )
}

export default MemoryFlash
