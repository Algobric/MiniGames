/**
 * ShellGame - Follow the ball!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

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
        updateGameState,
        endGame
    } = engine

    const isLeader = players.length > 0 && players[0].id === currentPlayerId

    // Visual state
    const [cupPositions, setCupPositions] = useState([0, 1, 2]) // Visual mapping: visualIndex -> cupId
    const [showBall, setShowBall] = useState(true)

    // Helper: Generate shuffle sequence
    const generateShuffles = (count: number): Swap[] => {
        const swaps: Swap[] = []
        for (let i = 0; i < count; i++) {
            const a = Math.floor(Math.random() * 3)
            let b = Math.floor(Math.random() * 3)
            while (b === a) b = Math.floor(Math.random() * 3)
            swaps.push([a, b])
        }
        return swaps
    }

    // Start Round Logic
    useEffect(() => {
        if (!isLeader || !isPlaying || winnerId) return

        if (gameState.round === 0 || (gameState.revealing === false && gameState.shuffling === false && gameState.picks.size > 0 && gameState.picks.size === players.length)) {
            // Round End or Start
            if (gameState.round >= TOTAL_ROUNDS && gameState.revealing) {
                // Game Over
                // Wait a bit
                return
            }
        }
    }, [isLeader, isPlaying, winnerId, gameState, players.length])


    // Managed Round Flow via Leader
    useEffect(() => {
        if (!isLeader || !isPlaying || winnerId) return

        // If Round 0, start immediately
        if (gameState.round === 0) {
            const startBall = Math.floor(Math.random() * 3)
            const swaps = generateShuffles(10)

            updateGameState(state => ({
                ...state,
                round: 1,
                ballPosition: startBall,
                swaps: swaps,
                shuffling: true,
                revealing: false,
                picks: new Map()
            }))
        } else if (gameState.revealing) {
            // Already revealing, after delay start next round
            const timer = setTimeout(() => {
                if (gameState.round >= TOTAL_ROUNDS) {
                    // End Game
                    const sorted = [...gameState.scores.entries()].sort((a, b) => b[1] - a[1])
                    const winner = sorted[0]?.[0] || null
                    endGame(winner)
                } else {
                    // Next Round
                    const startBall = Math.floor(Math.random() * 3)
                    const swaps = generateShuffles(10 + gameState.round * 2)
                    updateGameState(state => ({
                        ...state,
                        round: state.round + 1,
                        ballPosition: startBall,
                        swaps: swaps,
                        shuffling: true,
                        revealing: false,
                        picks: new Map()
                    }))
                }
            }, 3000)
            return () => clearTimeout(timer)
        } else if (!gameState.shuffling && !gameState.revealing && gameState.picks.size >= players.length) {
            // All picked, Reveal
            updateGameState(state => {
                // Calculate updated scores here
                // Wait, we need to know where the ball is.
                // The ball was at `ballPosition` (logic index of cup).
                // We need to track the swaps relative to positions?
                // No, `cupPositions` is visual state.
                // Leader needs to know the final mapping to judge picks.

                // Let's replicate the swap logic to account for final pos
                // Initial visual: [0, 1, 2] -> cups 0, 1, 2 are at slots 0, 1, 2.
                // Swaps operate on SLOTS.
                // swap(0, 1) means Cup at Slot 0 swaps with Cup at Slot 1.

                const slots = [0, 1, 2] // slots[i] = cupId
                state.swaps.forEach(([a, b]) => {
                    const temp = slots[a]
                    slots[a] = slots[b]
                    slots[b] = temp
                })

                // Ball is in cupId `ballPosition`.
                // Find which slot contains `ballPosition`.
                const winningSlot = slots.indexOf(state.ballPosition)

                const newScores = new Map(state.scores)
                state.picks.forEach((pickSlot, pid) => {
                    if (pickSlot === winningSlot) {
                        newScores.set(pid, (newScores.get(pid) || 0) + 1)
                    }
                })

                return {
                    ...state,
                    scores: newScores,
                    revealing: true
                }
            })
        }
    }, [gameState.round, gameState.revealing, gameState.shuffling, gameState.picks.size, players.length, isLeader, isPlaying, winnerId, updateGameState, endGame])


    // Client Side Animation Handling
    useEffect(() => {
        if (gameState.shuffling) {
            // Reset visual
            setCupPositions([0, 1, 2]) // Reset to identity? 
            // BE CAREFUL: Visual continuity.
            // Ideally we just snap to [0,1,2] at start of round? 
            // Or keep previous?
            // Simplest: Reset to [0,1,2] where Ball is at `ballPosition`.

            setShowBall(true)

            // Initial Preview
            setTimeout(() => {
                setShowBall(false)

                // Play Swaps
                let swapIdx = 0
                const playNextSwap = () => {
                    if (swapIdx >= gameState.swaps.length) {
                        // Done shuffling
                        if (isLeader) {
                            updateGameState(state => ({ ...state, shuffling: false }))
                        }
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

    }, [gameState.shuffling, gameState.revealing, gameState.swaps, gameState.ballPosition, isLeader, updateGameState])

    // Wait, if we reset `cupPositions` to [0,1,2], we must ensure `ballPosition` matches cup IDs.
    // Yes, `ballPosition` is 0,1,or 2.
    // `cupPositions` maps Slot -> CupID. Initially Slot 0 has Cup 0.
    // If Ball is in Cup 1. Initial State: Slot 1 has Cup 1 (Ball).
    // Swaps accumulate.
    // This logic holds.

    const handlePick = useCallback((slotIndex: number) => {
        if (!isPlaying || !currentPlayerId) return
        if (gameState.shuffling || gameState.revealing) return
        if (gameState.picks.has(currentPlayerId)) return

        playTap()
        updateGameState(state => ({
            ...state,
            picks: new Map([...state.picks, [currentPlayerId, slotIndex]])
        }))
    }, [isPlaying, currentPlayerId, gameState.shuffling, gameState.revealing, gameState.picks, updateGameState])

    const CUP_COLORS = ['#8B4513', '#A0522D', '#D2691E']

    // Determine correctness for UI feedback
    const getWinnerSlot = () => {
        const slots = [0, 1, 2]
        gameState.swaps.forEach(([a, b]) => {
            const temp = slots[a]
            slots[a] = slots[b]
            slots[b] = temp
        })
        return slots.indexOf(gameState.ballPosition)
    }
    const winningSlot = getWinnerSlot()

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
                        {[0, 1, 2].map(slotIndex => {
                            const cupId = cupPositions[slotIndex] // Which Cup is here?
                            const hasBall = cupId === gameState.ballPosition
                            const myPick = gameState.picks.get(currentPlayerId || '')
                            const isPicked = myPick === slotIndex

                            // Reveal feedback
                            const isCorrect = slotIndex === winningSlot
                            const showResult = gameState.revealing

                            return (
                                <motion.button
                                    key={slotIndex} // Key by slot index so they don't re-mount, just animate? 
                                // Actually, if we use `layout`, Framer Motion animates position changes if we re-order DOM.
                                // But here we are just changing props of fixed slots?
                                // No, the shuffle animation swaps the contents visually.
                                // If we want smooth swap animation, we should render CUPS and position them absolutely based on slot.
                                // But current implementation updates `cupPositions` state and relies on react re-render?
                                // The previous impl used `cupPositions` and just swapped data.
                                // Line 188: `rotateY` animation.
                                // Let's stick to the Slot-based render, but animate the Swap?
                                // Without complex layout animations, the cups will just "jump" or we rely on `layout` prop?
                                // Let's try to map Cups to Slots for rendering.
                                // Actually, rendering Cups by ID and positioning them is better for animation.
                                />
                            )
                        })}

                        {/* Better Render Strategy: Render Cups 0,1,2 and position them based on current Slot */}
                        <div className="relative w-80 h-32">
                            {[0, 1, 2].map(cupId => {
                                // Find current slot of this cup
                                const slotIndex = cupPositions.indexOf(cupId)
                                const hasBall = cupId === gameState.ballPosition

                                // X position: 0 -> 0%, 1 -> 50%, 2 -> 100% (roughly)
                                // Center them:
                                const xPos = slotIndex * 110 // px

                                const myPick = gameState.picks.get(currentPlayerId || '')
                                const isPicked = myPick === slotIndex // Wait, pick is by Slot

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
