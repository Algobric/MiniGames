/**
 * TypeRace - Type the phrase fastest!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playWinFanfare } from '../HighNoon/sounds'

const PHRASES = [
    "The quick brown fox jumps",
    "Green cats on the rooftop",
    "Pizza is eternal life",
    "Clean code always wins",
    "Abracadabra magic words",
    "Robots dream of sheep",
    "Coffee rains in desert",
    "Metal blue butterflies",
    "Dinosaurs with hats on",
    "WiFi is modern magic"
]

interface TypeRaceState {
    targetPhrase: string
    // typedText: string // Removed to prevent confusion, local only
    progress: Map<string, number>
    startTime: number
    finishTimes: Map<string, number>
}

const TypeRace = () => {
    const engine = useMinigameEngine<TypeRaceState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            targetPhrase: '',
            progress: new Map(),
            startTime: 0,
            finishTimes: new Map()
        },
        gameReducer: (state, event) => {
            if (event.type === 'START_RACE') {
                const { phrase, startTime } = event as any
                return {
                    ...state,
                    targetPhrase: phrase,
                    startTime,
                    progress: new Map(),
                    finishTimes: new Map()
                }
            }
            if (event.type === 'UPDATE_PROGRESS') {
                const { progress } = event as any
                const newProgress = new Map(state.progress)
                newProgress.set(event.senderId, progress)

                // Check finish
                if (progress >= 100) {
                    const time = Date.now() - state.startTime
                    const newFinishTimes = new Map(state.finishTimes)
                    // Keep first finish time if already set
                    if (!newFinishTimes.has(event.senderId)) {
                        newFinishTimes.set(event.senderId, time)
                    }
                    return { ...state, progress: newProgress, finishTimes: newFinishTimes }
                }

                return { ...state, progress: newProgress }
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

    const inputRef = useRef<HTMLInputElement>(null)
    const gameEndedRef = useRef(false)
    const [localTypedText, setLocalTypedText] = useState('')

    // Initialize progress and start game (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (isPlaying && isLeader && !gameState.targetPhrase) {
            const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)]
            dispatchGameEvent('START_RACE', { phrase, startTime: Date.now() })
        }
    }, [isPlaying, gameState.targetPhrase, players, currentPlayerId, dispatchGameEvent])

    // Focus input on start
    useEffect(() => {
        if (isPlaying && gameState.targetPhrase) {
            setTimeout(() => inputRef.current?.focus(), 100)
            setLocalTypedText('')
        }
    }, [isPlaying, gameState.targetPhrase])

    // Game End Checker (Host)
    useEffect(() => {
        const isLeader = players.length > 0 && players[0].id === currentPlayerId
        if (!isLeader) return

        if (gameState.finishTimes.size > 0 && !gameEndedRef.current) {
            const winner = Array.from(gameState.finishTimes.entries()).sort((a, b) => a[1] - b[1])[0]?.[0]
            if (winner) {
                gameEndedRef.current = true
                playWinFanfare()
                endGame(winner, [{
                    playerId: winner,
                    score: 100,
                    rank: 1,
                    metadata: { time: gameState.finishTimes.get(winner) }
                }])
            }
        }
    }, [gameState.finishTimes, endGame, players, currentPlayerId])


    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isPlaying || !currentPlayerId || winnerId ||
            gameState.finishTimes.has(currentPlayerId)) return

        const newText = e.target.value
        setLocalTypedText(newText)

        // Calculate progress
        let correct = 0
        for (let i = 0; i < newText.length && i < gameState.targetPhrase.length; i++) {
            if (newText[i] === gameState.targetPhrase[i]) correct++
            else break
        }
        const progressPct = Math.round((correct / gameState.targetPhrase.length) * 100)

        // Dispatch Progress
        dispatchGameEvent('UPDATE_PROGRESS', { progress: progressPct })

        // Check completion local feedback
        if (newText === gameState.targetPhrase) {
            playTap()
        }
    }, [isPlaying, currentPlayerId, winnerId, gameState, dispatchGameEvent])

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            backgroundColor="bg-gradient-to-b from-indigo-900 to-purple-950"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        ⌨️ TYPE RACE!
                    </h1>
                </div>

                {isPlaying && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
                        <div className="text-center mb-6 p-4 bg-white/10 rounded-lg">
                            <div className="text-sm text-white/50 mb-2">Type this:</div>
                            <div className="text-2xl text-white font-mono">
                                {gameState.targetPhrase.split('').map((char, i) => {
                                    const typed = localTypedText[i]
                                    const isCorrect = typed === char
                                    const isTyped = i < localTypedText.length

                                    return (
                                        <span
                                            key={i}
                                            className={clsx(
                                                isTyped && isCorrect && "text-green-400",
                                                isTyped && !isCorrect && "text-red-400 bg-red-900/50",
                                                !isTyped && "text-white/70"
                                            )}
                                        >
                                            {char}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>

                        <input
                            ref={inputRef}
                            type="text"
                            value={localTypedText}
                            onChange={handleInputChange}
                            disabled={!isPlaying || gameState.finishTimes.has(currentPlayerId || '')}
                            className="w-full px-4 py-3 text-xl font-mono bg-white/20 border-2 border-white/30 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                            placeholder="Start typing..."
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                        />

                        <div className="w-full mt-6 space-y-3">
                            {players.map(player => {
                                const prog = gameState.progress.get(player.id) || 0
                                const finished = gameState.finishTimes.has(player.id)
                                const time = gameState.finishTimes.get(player.id)

                                return (
                                    <div key={player.id}>
                                        <div className="flex justify-between text-sm text-white mb-1">
                                            <span className={player.id === winnerId ? "text-yellow-400" : ""}>
                                                {player.username} {finished && `✓ ${((time || 0) / 1000).toFixed(2)}s`}
                                            </span>
                                            <span>{prog}%</span>
                                        </div>
                                        <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                                            <motion.div
                                                animate={{ width: `${prog}%` }}
                                                className={clsx(
                                                    "h-full rounded-full",
                                                    player.id === currentPlayerId ? "bg-cyan-500" : "bg-pink-500",
                                                    finished && "bg-green-500"
                                                )}
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

export default TypeRace
