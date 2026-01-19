/**
 * TypeRace - Type the phrase fastest!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef } from 'react'
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
    typedText: string
    progress: Map<string, number>
    startTime: number
    finishTimes: Map<string, number>
}

const TypeRace = () => {
    const engine = useMinigameEngine<TypeRaceState>({
        config: { countdownDuration: 3 },
        initialGameState: {
            targetPhrase: '',
            typedText: '',
            progress: new Map(),
            startTime: 0,
            finishTimes: new Map()
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

    const inputRef = useRef<HTMLInputElement>(null)
    const gameEndedRef = useRef(false)

    // Initialize progress and start game
    useEffect(() => {
        if (isPlaying && !gameState.targetPhrase) {
            const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)]
            updateGameState(state => ({
                ...state,
                targetPhrase: phrase,
                startTime: Date.now(),
                progress: new Map(players.map(p => [p.id, 0]))
            }))
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isPlaying, gameState.targetPhrase, players, updateGameState])

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isPlaying || !currentPlayerId || winnerId ||
            gameState.finishTimes.has(currentPlayerId)) return

        const newText = e.target.value

        // Calculate progress
        let correct = 0
        for (let i = 0; i < newText.length && i < gameState.targetPhrase.length; i++) {
            if (newText[i] === gameState.targetPhrase[i]) correct++
            else break
        }
        const progressPct = Math.round((correct / gameState.targetPhrase.length) * 100)

        updateGameState(state => ({
            ...state,
            typedText: newText,
            progress: new Map([...state.progress, [currentPlayerId, progressPct]])
        }))

        // Check completion
        if (newText === gameState.targetPhrase) {
            if (gameEndedRef.current) return
            gameEndedRef.current = true

            const finishTime = Date.now() - gameState.startTime
            playTap()

            updateGameState(state => ({
                ...state,
                finishTimes: new Map([...state.finishTimes, [currentPlayerId, finishTime]])
            }))

            playWinFanfare()
            endGame(currentPlayerId, [{
                playerId: currentPlayerId,
                score: 100,
                rank: 1,
                metadata: { time: finishTime }
            }])
        }
    }, [isPlaying, currentPlayerId, winnerId, gameState, updateGameState, endGame])

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
                                    const typed = gameState.typedText[i]
                                    const isCorrect = typed === char
                                    const isTyped = i < gameState.typedText.length

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
                            value={gameState.typedText}
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
