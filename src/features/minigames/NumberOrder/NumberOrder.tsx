/**
 * NumberOrder - Click 1 to 10!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare, playFail } from '../HighNoon/sounds'

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface NumberOrderState {
    shuffledNumbers: number[]
    startTime: number
    finishTimes: Map<string, number>
    // We track progress in local state to allow instant UI updates, 
    // but we can sync it if we want other players to see progress bars.
    progress: Map<string, number>
}

const NumberOrder = () => {
    const engine = useMinigameEngine<NumberOrderState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            shuffledNumbers: [],
            startTime: 0,
            finishTimes: new Map(),
            progress: new Map()
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

    const [nextNumber, setNextNumber] = useState(1)
    const gameEndedRef = useRef(false)
    const isLeader = players.length > 0 && players[0].id === currentPlayerId

    // Leader initializes numbers
    useEffect(() => {
        if (isPlaying && isLeader && gameState.shuffledNumbers.length === 0) {
            const shuffled = [...NUMBERS].sort(() => Math.random() - 0.5)
            updateGameState(state => ({
                ...state,
                shuffledNumbers: shuffled,
                startTime: Date.now(),
                progress: new Map(players.map(p => [p.id, 0]))
            }))
        }
    }, [isPlaying, isLeader, gameState.shuffledNumbers.length, players, updateGameState])

    const handleNumberClick = useCallback((num: number) => {
        if (!isPlaying || !currentPlayerId || winnerId || gameState.finishTimes.has(currentPlayerId)) return

        if (num === nextNumber) {
            playTap()
            const newNext = nextNumber + 1
            setNextNumber(newNext)

            // Sync progress occasionally or on every click? 
            // Every click for this game is fine, it's not super high frequency (10 clicks)
            updateGameState(state => ({
                ...state,
                progress: new Map([...state.progress, [currentPlayerId, newNext - 1]])
            }))

            if (newNext > NUMBERS.length) {
                if (gameEndedRef.current) return
                gameEndedRef.current = true

                const finishTime = Date.now() - gameState.startTime
                playWinFanfare()

                // First to finish wins immediately? Or wait? 
                // Usually these races are "First one wins".
                updateGameState(state => ({
                    ...state,
                    finishTimes: new Map([...state.finishTimes, [currentPlayerId, finishTime]])
                }))

                endGame(currentPlayerId)
            }
        } else {
            playFail()
        }
    }, [isPlaying, currentPlayerId, winnerId, nextNumber, gameState.startTime, gameState.finishTimes, updateGameState, endGame])

    // Grid positions need to be stable based on shuffled numbers
    // But shuffledNumbers comes from state.
    // We can map them based on index in the shuffled array.
    const getPosition = (index: number) => ({
        x: (index % 5) * 20 + 10,
        y: Math.floor(index / 5) * 40 + 20
    })

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-teal-800 to-teal-950"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🔢 NUMBER ORDER!
                    </h1>
                    <p className="text-lg text-cyan-400">Click 1 to 10 in order</p>
                </div>

                {/* Main Game Area */}
                {gameState.shuffledNumbers.length > 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <div className="relative w-80 h-40 mb-6">
                            {gameState.shuffledNumbers.map((num, i) => {
                                const isClicked = num < nextNumber
                                const isNext = num === nextNumber
                                const pos = getPosition(i)

                                return (
                                    <motion.button
                                        key={num}
                                        initial={{ scale: 0 }}
                                        animate={{
                                            scale: isClicked ? 0 : 1,
                                            opacity: isClicked ? 0 : 1
                                        }}
                                        whileHover={{ scale: isClicked ? 0 : 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleNumberClick(num)}
                                        disabled={isClicked || !!winnerId}
                                        className={clsx(
                                            "absolute w-12 h-12 rounded-xl text-xl font-pixel flex items-center justify-center",
                                            isNext ? "bg-yellow-500 text-black ring-4 ring-yellow-300" : "bg-teal-600 text-white"
                                        )}
                                        style={{
                                            left: `${pos.x}%`,
                                            top: `${pos.y}%`,
                                            transform: 'translate(-50%, -50%)' // Fix centering
                                        }}
                                    >
                                        {num}
                                    </motion.button>
                                )
                            })}
                        </div>

                        {/* Next Indicator */}
                        <div className="text-2xl text-white mb-4">
                            Next: <span className="text-yellow-400 font-pixel">{nextNumber <= NUMBERS.length ? nextNumber : '✓'}</span>
                        </div>

                        {/* Progress Bars */}
                        <div className="w-full max-w-md space-y-2">
                            {players.map(player => {
                                const prog = gameState.progress.get(player.id) || 0
                                const isWinner = player.id === winnerId

                                return (
                                    <div key={player.id} className="flex items-center gap-3">
                                        <span className={clsx("text-sm w-24 truncate", isWinner && "text-yellow-400")}>
                                            {player.username}
                                        </span>
                                        <div className="flex-1 h-4 bg-white/20 rounded-full overflow-hidden">
                                            <motion.div
                                                animate={{ width: `${(prog / NUMBERS.length) * 100}%` }}
                                                className={clsx("h-full rounded-full", isWinner ? "bg-green-500" : "bg-cyan-500")}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </MinigameWrapper>
    )
}

export default NumberOrder
