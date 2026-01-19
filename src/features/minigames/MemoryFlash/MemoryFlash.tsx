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
        },
        gameReducer: (state, event) => {
            if (event.type === 'NEW_ROUND') {
                const { round, sequence, alivePlayers } = event as any
                // If alivePlayers provided (game start), usage. Else keep existing.
                // Actually host should send alivePlayers to ensure consistency?
                // Or we trust state.
                // Let's reset results.
                return {
                    ...state,
                    round,
                    sequence,
                    showingIndex: -1,
                    playerInput: [],
                    roundResults: new Map(),
                    localPhase: 'SHOWING',
                    flashButton: null,
                    // If we want to sync alive players explicitly on new round:
                    alivePlayers: alivePlayers ? new Set(alivePlayers) : state.alivePlayers
                }
            }
            if (event.type === 'PLAYER_FAIL') {
                const { round } = event as any
                if (round !== state.round) return state

                const newAlive = new Set(state.alivePlayers)
                newAlive.delete(event.senderId)
                const newResults = new Map(state.roundResults)
                newResults.set(event.senderId, false)

                return { ...state, alivePlayers: newAlive, roundResults: newResults }
            }
            if (event.type === 'PLAYER_SUCCESS') {
                const { round } = event as any
                if (round !== state.round) return state

                const newResults = new Map(state.roundResults)
                newResults.set(event.senderId, true)
                return { ...state, roundResults: newResults }
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

    const inputRef = useRef<number[]>([])
    const gameEndedRef = useRef(false)
    const isAlive = currentPlayerId ? gameState.alivePlayers.has(currentPlayerId) : false

    // Initialize alive players (Host Init)
    useEffect(() => {
        if (players.length > 0 && gameState.alivePlayers.size === 0) {
            // Host sends initial round which includes alive players?
            // Or we just set it locally for now waiting for round 1?
            // Better: Init state locally matching players.
            updateGameState(state => ({
                ...state,
                alivePlayers: new Set(players.map(p => p.id))
            }))
        }
    }, [players, gameState.alivePlayers.size, updateGameState])

    // Start first round (Host Only)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (isPlaying && gameState.round === 0 && isLeader && players.length > 0) {
            startHostRound(1, STARTING_LENGTH, players.map(p => p.id))
        }
    }, [isPlaying, gameState.round, players, currentPlayerId]) // players dep ensures we have players

    const startHostRound = useCallback((roundNum: number, length: number, currentAlive: string[]) => {
        const newSequence: number[] = []
        for (let i = 0; i < length; i++) {
            newSequence.push(Math.floor(Math.random() * 4))
        }

        dispatchGameEvent('NEW_ROUND', {
            round: roundNum,
            sequence: newSequence,
            alivePlayers: currentAlive
        })
    }, [dispatchGameEvent])

    // Show sequence animation (Client Side React to State Change)
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
                inputRef.current = [] // Reset input ref
                updateGameState(state => ({
                    ...state,
                    localPhase: 'INPUT' as const,
                    playerInput: []
                }))
            }
        }

        const timeout = setTimeout(showNext, 1000) // Small delay before start
        return () => clearTimeout(timeout)
    }, [gameState.sequence, isPlaying, updateGameState])
    // removed gameState.localPhase from dep strictly to avoid re-trigger if logic changes phase elsewhere
    // But we NEED it to trigger on phase change to SHOWING.
    // 'sequence' acts as trigger too if it changes.
    // The previous code had it. Let's keep strict deps but ensure logic doesn't infinite loop.

    // Host Logic: Check for Round Completion
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        // Check if all alive players have submitted result
        const aliveIds = Array.from(gameState.alivePlayers)
        if (aliveIds.length === 0) return // Should not happen start of game

        const allReported = aliveIds.every(id => gameState.roundResults.has(id))

        if (allReported) {
            // Calculate Next Step
            const nextAlive = aliveIds.filter(id => gameState.roundResults.get(id) === true)

            if (nextAlive.length <= 1) {
                // Game End or Winner
                // If 1 winner -> Winner.
                // If 0 -> Draw (everyone died this round). OR Last Man Standing logic handled?
                // If 0 nextAlive, it means everyone stored in 'alivePlayers' failed.
                // So we check previous state? 
                // If everyone failed simultaneously, maybe they tie? Or no winner?
                // Simple: If nextAlive.length === 1, that one wins.
                // If 0, No winner (or previous round survivor? hard to track).

                // Wait, check if we reached MAX Rounds too.

                const winner = nextAlive.length === 1 ? nextAlive[0] : null
                // If 0 alive, winner is null.

                if (!gameEndedRef.current) {
                    gameEndedRef.current = true
                    playWinFanfare()
                    endGame(winner)
                }
            } else {
                if (gameState.round >= MAX_LENGTH) {
                    // End with multiple winners or Tie?
                    // Just end.
                    if (!gameEndedRef.current) {
                        gameEndedRef.current = true
                        playWinFanfare()
                        endGame(null) // Tie
                    }
                } else {
                    // Next Round
                    // Dispatch Phase Change? No, NEW_ROUND resets everything.
                    // But we should show RESULTS briefly.
                    // We can't use 'localPhase' for Global Sync because 'localPhase' is local.
                    // Unless we sync it?
                    // Let's just wait and start new round. 
                    // Clients see their result in 'roundResults'.
                    setTimeout(() => {
                        startHostRound(gameState.round + 1, STARTING_LENGTH + gameState.round, nextAlive)
                    }, 2000)
                }
            }
        }

    }, [gameState.roundResults, gameState.alivePlayers, gameState.round, startHostRound, endGame, players, currentPlayerId])


    const handleButtonPress = useCallback((buttonIndex: number) => {
        if (gameState.localPhase !== 'INPUT' || !currentPlayerId || !isAlive || winnerId) return

        playTap()
        updateGameState(state => ({ ...state, flashButton: buttonIndex }))
        setTimeout(() => updateGameState(state => ({ ...state, flashButton: null })), 100)

        // Optimistic Input Update
        const newInput = [...inputRef.current, buttonIndex]
        inputRef.current = newInput
        updateGameState(state => ({ ...state, playerInput: newInput }))

        const currentPos = newInput.length - 1
        const isCorrect = gameState.sequence[currentPos] === buttonIndex

        if (!isCorrect) {
            playFail()
            // Dispatch Fail
            dispatchGameEvent('PLAYER_FAIL', { round: gameState.round })
            // Local lock
            updateGameState(state => ({ ...state, localPhase: 'RESULT' as const })) // Or just stop input
        } else if (newInput.length === gameState.sequence.length) {
            // Success
            dispatchGameEvent('PLAYER_SUCCESS', { round: gameState.round })
            updateGameState(state => ({ ...state, localPhase: 'RESULT' as const }))
        }
    }, [gameState, currentPlayerId, isAlive, winnerId, dispatchGameEvent, updateGameState])

    // Removed checkRoundEnd local function as it is now Host Driven via Effects

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
