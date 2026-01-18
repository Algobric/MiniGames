import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'AIMING' | 'POWER' | 'FLYING' | 'ENDED'

const HOLE_X = 280
const HOLE_Y = 150
const HOLE_RADIUS = 15

const OneClickGolf: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [angle, setAngle] = useState(0) // 0-180 degrees
    const [power, setPower] = useState(0) // 0-100
    const [ballPos, setBallPos] = useState({ x: 50, y: 180 })
    const [results, setResults] = useState<Map<string, number>>(new Map()) // Distance to hole
    const [currentTurn, setCurrentTurn] = useState(0)
    const [winner, setWinner] = useState<string | null>(null)
    const [isMyTurn, setIsMyTurn] = useState(false)

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const isHostRef = useRef(isHost)
    isHostRef.current = isHost

    useEffect(() => {
        const handleInteraction = () => { unlockAudio(); window.removeEventListener('pointerdown', handleInteraction) }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    useEffect(() => {
        if (phase !== 'COUNTDOWN') return

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    playCountdownBeep(true)
                    if (isHostRef.current) {
                        broadcastAndApply({ type: 'GOLF_START', turn: 0 })
                    }
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [phase, broadcastAndApply])

    // Angle oscillation
    useEffect(() => {
        if (phase !== 'AIMING' || !isMyTurn) return
        const interval = setInterval(() => {
            setAngle(prev => {
                const speed = 3
                const newAngle = prev + speed
                return newAngle > 180 ? 0 : newAngle
            })
        }, 30)
        return () => clearInterval(interval)
    }, [phase, isMyTurn])

    // Power oscillation
    useEffect(() => {
        if (phase !== 'POWER' || !isMyTurn) return
        const interval = setInterval(() => {
            setPower(prev => {
                const newPower = prev + 4
                return newPower > 100 ? 0 : newPower
            })
        }, 30)
        return () => clearInterval(interval)
    }, [phase, isMyTurn])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'GOLF_START') {
            setCurrentTurn(lastBroadcast.turn)
            setIsMyTurn(players[lastBroadcast.turn]?.id === currentPlayer?.id)
            setBallPos({ x: 50, y: 180 })
            setAngle(0)
            setPower(0)
            setPhase('AIMING')
        }

        if (lastBroadcast.type === 'GOLF_SHOT') {
            // Simulate ball flight
            const rad = (lastBroadcast.angle * Math.PI) / 180
            const distance = lastBroadcast.power * 2.5

            const endX = 50 + Math.cos(rad) * distance
            const endY = 180 - Math.sin(rad) * distance

            setBallPos({ x: endX, y: endY })

            // Calculate distance to hole
            const distToHole = Math.sqrt((endX - HOLE_X) ** 2 + (endY - HOLE_Y) ** 2)
            const isHoleInOne = distToHole <= HOLE_RADIUS

            setResults(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, isHoleInOne ? 0 : distToHole)
                return next
            })

            if (lastBroadcast.playerId === currentPlayer?.id) {
                if (isHoleInOne) playWinFanfare()
                else playTap()
            }

            // Next turn or end
            if (isHost) {
                setTimeout(() => {
                    const nextTurn = currentTurn + 1
                    if (nextTurn >= players.length) {
                        // Find winner (closest to hole)
                        let winnerId = players[0]?.id
                        let minDist = Infinity
                        const allResults = new Map(results)
                        allResults.set(lastBroadcast.playerId, isHoleInOne ? 0 : distToHole)

                        allResults.forEach((dist, playerId) => {
                            if (dist < minDist) { minDist = dist; winnerId = playerId }
                        })

                        broadcastAndApply({ type: 'GOLF_GAME_OVER', winnerId, results: Object.fromEntries(allResults) })
                    } else {
                        broadcastAndApply({ type: 'GOLF_START', turn: nextTurn })
                    }
                }, 2000)
            }
        }

        if (lastBroadcast.type === 'GOLF_GAME_OVER') {
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            setResults(new Map(Object.entries(lastBroadcast.results)))
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, players, currentPlayer?.id, currentTurn, results, isHost, onGameEnd, broadcastAndApply])

    const handleClick = useCallback(() => {
        if (!isMyTurn || !currentPlayer) return

        if (phase === 'AIMING') {
            playTap()
            setPhase('POWER')
        } else if (phase === 'POWER') {
            broadcastAndApply({ type: 'GOLF_SHOT', playerId: currentPlayer.id, angle, power })
            setPhase('FLYING')
        }
    }, [phase, isMyTurn, currentPlayer, angle, power, broadcastAndApply])

    const currentPlayerObj = players[currentTurn]

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-green-500 to-green-700 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>⛳ GOLF DE UN CLICK!</h1>
                {phase !== 'COUNTDOWN' && phase !== 'ENDED' && (
                    <div className="text-lg text-yellow-300">Turno: {currentPlayerObj?.username}</div>
                )}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && phase !== 'ENDED' && (
                <div className="relative w-80 h-48 bg-green-600 rounded-lg border-4 border-green-800 overflow-hidden">
                    {/* Hole */}
                    <div
                        className="absolute rounded-full bg-black border-2 border-white"
                        style={{
                            left: HOLE_X - HOLE_RADIUS,
                            top: HOLE_Y - HOLE_RADIUS,
                            width: HOLE_RADIUS * 2,
                            height: HOLE_RADIUS * 2
                        }}
                    >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-2xl">🚩</div>
                    </div>

                    {/* Ball */}
                    <motion.div
                        animate={{ left: ballPos.x - 5, top: ballPos.y - 5 }}
                        transition={{ type: 'spring', damping: 10 }}
                        className="absolute w-3 h-3 bg-white rounded-full shadow-lg"
                    />

                    {/* Aiming arrow */}
                    {phase === 'AIMING' && isMyTurn && (
                        <motion.div
                            animate={{ rotate: -angle }}
                            className="absolute origin-left"
                            style={{ left: ballPos.x, top: ballPos.y, transform: `rotate(${-angle}deg)` }}
                        >
                            <div className="w-20 h-1 bg-red-500" />
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-8 border-l-red-500 border-y-4 border-y-transparent" />
                        </motion.div>
                    )}
                </div>
            )}

            {/* Power meter */}
            {phase === 'POWER' && isMyTurn && (
                <div className="w-64 h-8 bg-gray-800 rounded-full overflow-hidden border-2 border-white">
                    <motion.div
                        animate={{ width: `${power}%` }}
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                    />
                </div>
            )}

            {/* Status */}
            {phase === 'AIMING' && isMyTurn && (
                <p className="text-xl text-white">Click para fijar dirección!</p>
            )}
            {phase === 'POWER' && isMyTurn && (
                <p className="text-xl text-white">Click para fijar potencia!</p>
            )}
            {phase === 'FLYING' && (
                <p className="text-xl text-white">⛳ Volando...</p>
            )}
            {!isMyTurn && phase !== 'COUNTDOWN' && phase !== 'ENDED' && (
                <p className="text-xl text-white/70">Esperando a {currentPlayerObj?.username}...</p>
            )}

            {/* Click button */}
            {isMyTurn && (phase === 'AIMING' || phase === 'POWER') && (
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleClick}
                    className="px-12 py-6 text-2xl font-pixel bg-yellow-500 text-black rounded-xl shadow-lg"
                >
                    ⛳ CLICK!
                </motion.button>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">⛳</div>
                        <div className="text-4xl font-pixel text-green-400 mb-4">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                        <div className="space-y-2">
                            {players.map(player => {
                                const dist = results.get(player.id)
                                return (
                                    <div key={player.id} className={clsx("text-xl", player.id === winner && "text-yellow-400")}>
                                        {player.username}: {dist === 0 ? '🎉 HOLE IN ONE!' : `${dist?.toFixed(0)}px`}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default OneClickGolf
