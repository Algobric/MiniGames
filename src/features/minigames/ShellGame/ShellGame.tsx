/**
 * ShellGame - Follow the ball!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap } from '../HighNoon/sounds'

const TOTAL_ROUNDS = 5

// A Swap is [cupA_Index, cupB_Index]
type Swap = [number, number]

interface ShellGameState {
    round: number
    scores: Map<string, number>
    shuffling: boolean
    revealing: boolean
    ballPosition: number // 0, 1, 2 (Logic position, tracked)
    swaps: Swap[] // Current shuffle sequence
    picks: Map<string, number> // playerId -> picked visual slot
}

const ShellGame = () => {
    const engine = useMinigameEngine<ShellGameState>({
        config: {
            countdownDuration: 3,
        },
        initialGameState: {
            round: 0,
            scores: new Map(),
            shuffling: false,
            revealing: false,
            ballPosition: 1,
            swaps: [],
            picks: new Map()
        },
        gameReducer: (state, event) => {
            if (event.type === 'INIT_GAME') {
                const { playerIds } = event as any
                return {
                    ...state,
                    scores: new Map(playerIds.map((id: string) => [id, 0])),
                    round: 0
                }
            }
            if (event.type === 'START_ROUND') {
                const { round, ballPosition, swaps } = event as any
                return {
                    ...state,
                    round,
                    ballPosition,
                    swaps,
                    shuffling: true,
                    revealing: false,
                    picks: new Map()
                }
            }
            if (event.type === 'END_SHUFFLE') {
                return { ...state, shuffling: false }
            }
            if (event.type === 'SUBMIT_PICK') {
                const { slotIndex } = event as any
                const newPicks = new Map(state.picks)
                newPicks.set(event.senderId, slotIndex)
                return { ...state, picks: newPicks }
            }
            if (event.type === 'REVEAL_ROUND') {
                const { scores } = event as any
                // scores is array entries
                const newScores = new Map(scores) as Map<string, number>
                return {
                    ...state,
                    revealing: true,
                    scores: newScores
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
        dispatchGameEvent
    } = engine

    // Visual state
    const [cupPositions, setCupPositions] = useState([0, 1, 2])
    const [showBall, setShowBall] = useState(true)

    // Helper: Generate shuffle sequence
    const generateShuffles = useCallback((count: number): Swap[] => {
        const swaps: Swap[] = []
        for (let i = 0; i < count; i++) {
            const a = Math.floor(Math.random() * 3)
            let b = Math.floor(Math.random() * 3)
            while (b === a) b = Math.floor(Math.random() * 3)
            swaps.push([a, b])
        }
        return swaps
    }, [])

    // Init Game (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (players.length > 0 && gameState.scores.size === 0 && isPlaying && isLeader) {
            dispatchGameEvent('INIT_GAME', { playerIds: players.map(p => p.id) })
        }
    }, [players, gameState.scores.size, isPlaying, currentPlayerId, dispatchGameEvent])

    // Managed Round Flow via Leader
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader || !isPlaying || winnerId) return

        // If Round 0, start immediately (after init)
        if (gameState.round === 0 && gameState.scores.size > 0) {
            // Start Round 1
            const startBall = Math.floor(Math.random() * 3)
            const swaps = generateShuffles(10)
            const shuffleDuration = 1500 + (swaps.length * 300) + 1000 // Buffer

            dispatchGameEvent('START_ROUND', { round: 1, ballPosition: startBall, swaps })

            // Schedule Enable Picking
            setTimeout(() => {
                dispatchGameEvent('END_SHUFFLE', {})
            }, shuffleDuration)
        }

        else if (gameState.revealing) {
            // Already revealing, after delay start next round
            const timer = setTimeout(() => {
                const nextRound = gameState.round + 1
                if (nextRound > TOTAL_ROUNDS) {
                    // End Game
                    const sorted = [...gameState.scores.entries()].sort((a, b) => b[1] - a[1])
                    const winner = sorted[0]?.[0] || null
                    endGame(winner)
                } else {
                    // Next Round
                    const startBall = Math.floor(Math.random() * 3)
                    const swaps = generateShuffles(10 + nextRound * 2)
                    const shuffleDuration = 1500 + (swaps.length * 300) + 1000

                    dispatchGameEvent('START_ROUND', { round: nextRound, ballPosition: startBall, swaps })

                    // Schedule Enable Picking
                    setTimeout(() => {
                        dispatchGameEvent('END_SHUFFLE', {})
                    }, shuffleDuration)
                }
            }, 3000)
            return () => clearTimeout(timer)
        }

        else if (!gameState.shuffling && !gameState.revealing && gameState.round > 0) {
            // Picking Phase
            // Check if all picked
            const allPicked = players.every(p => gameState.picks.has(p.id))

            // Or timeout? Let's just use allPicked for now or implement timer later.
            // For simplicity, wait for all.

            if (allPicked) {
                // Calculate Scores
                const slots = [0, 1, 2] // slots[i] = cupId
                gameState.swaps.forEach(([a, b]) => {
                    const temp = slots[a]
                    slots[a] = slots[b]
                    slots[b] = temp
                })
                const winningSlot = slots.indexOf(gameState.ballPosition)

                const newScores = new Map(gameState.scores)
                gameState.picks.forEach((pickSlot, pid) => {
                    if (pickSlot === winningSlot) {
                        newScores.set(pid, (newScores.get(pid) || 0) + 1)
                    }
                })

                dispatchGameEvent('REVEAL_ROUND', { scores: Array.from(newScores.entries()) })
            }
        }
    }, [gameState.round, gameState.revealing, gameState.shuffling, gameState.picks, gameState.scores.size, gameState.swaps, gameState.ballPosition, gameState.scores, players, isPlaying, winnerId, dispatchGameEvent, endGame, generateShuffles])

    // Client Side Animation Handling
    useEffect(() => {
        if (gameState.shuffling) {
            // Reset visual
            setCupPositions([0, 1, 2])
            setShowBall(true)

            // Initial Preview
            setTimeout(() => {
                setShowBall(false)

                // Play Swaps
                let swapIdx = 0
                const playNextSwap = () => {
                    if (swapIdx >= gameState.swaps.length) {
                        // Done shuffling
                        // No need to dispatch here, Host handles END_SHUFFLE via timing
                        return
                    }

                    const [a, b] = gameState.swaps[swapIdx]
                    setCupPositions(prev => {
                        const next = [...prev]
                        const temp = next[a]
                        next[a] = next[b]
                        next[b] = temp
                        return next
                    })

                    swapIdx++
                    setTimeout(playNextSwap, 300) // Speed
                }

                setTimeout(playNextSwap, 1000)

            }, 1500)
        } else if (gameState.revealing) {
            // Show ball
            setShowBall(true)
        }
    }, [gameState.shuffling, gameState.revealing, gameState.swaps])

    const handlePick = useCallback((slotIndex: number) => {
        if (!isPlaying || !currentPlayerId) return
        if (gameState.shuffling || gameState.revealing) return
        if (gameState.picks.has(currentPlayerId)) return

        playTap()
        dispatchGameEvent('SUBMIT_PICK', { slotIndex })
    }, [isPlaying, currentPlayerId, gameState.shuffling, gameState.revealing, gameState.picks, dispatchGameEvent])

    const CUP_COLORS = ['#8B4513', '#A0522D', '#D2691E']

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-amber-800 to-amber-950"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🎩 SHELL GAME
                    </h1>
                    {isPlaying && <div className="text-lg text-yellow-400">Round {gameState.round} / {TOTAL_ROUNDS}</div>}
                </div>

                {isPlaying && (
                    <div className="flex-1 flex items-center justify-center gap-4">
                        <div className="relative w-80 h-32">
                            {[0, 1, 2].map(cupId => {
                                // Find current slot of this cup
                                const slotIndex = cupPositions.indexOf(cupId)
                                const hasBall = cupId === gameState.ballPosition

                                // X position based on Slot index
                                const xPos = slotIndex * 110 // px

                                const myPick = gameState.picks.get(currentPlayerId || '')
                                const isPicked = myPick === slotIndex

                                return (
                                    <motion.div
                                        key={cupId}
                                        className="absolute top-0 w-24"
                                        animate={{ x: xPos }}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        onClick={() => handlePick(slotIndex)}
                                    >
                                        {/* Cup Graphic */}
                                        <motion.div
                                            animate={{
                                                y: (showBall || gameState.revealing) && hasBall ? -50 : 0,
                                            }}
                                            className={clsx("w-24 h-28 rounded-t-full relative z-10 cursor-pointer", isPicked && "ring-4 ring-yellow-400")}
                                            style={{
                                                background: `linear-gradient(to right, ${CUP_COLORS[cupId % 3]}, #8B4513)`,
                                                borderBottom: '4px solid #502000'
                                            }}
                                        >
                                            {/* Number/Label? No, they should look identical. */}
                                        </motion.div>

                                        {/* Ball (Behind cup, revealed when cup goes up) */}
                                        {hasBall && (
                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-red-500 shadow-xl z-0" />
                                        )}

                                        {/* Pick Indicator */}
                                        {isPicked && <div className="text-center text-3xl mt-2">👆</div>}
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                )}

                <div className="text-xl text-white font-pixel h-8">
                    {gameState.shuffling ? "SHUFFLING..." :
                        gameState.revealing ? "REVEAL!" :
                            !gameState.picks.has(currentPlayerId || '') ? "PICK A CUP!" : "WAITING..."}
                </div>

                {/* Scores */}
                <div className="flex gap-4 pb-4">
                    {players.map(p => (
                        <div key={p.id} className={clsx("px-4 py-2 rounded bg-black/30", p.id === currentPlayerId && "border border-yellow-400")}>
                            <div className="text-xs text-white/70">{p.username}</div>
                            <div className="text-xl text-yellow-400">{gameState.scores.get(p.id) || 0}</div>
                        </div>
                    ))}
                </div>
            </div>
        </MinigameWrapper>
    )
}

export default ShellGame
