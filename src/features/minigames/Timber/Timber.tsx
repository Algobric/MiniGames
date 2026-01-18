import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { playTap, playCountdownBeep, playWinFanfare, playFail, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'
type Side = 'left' | 'right'

// Each tree has branches on alternating sides
interface Branch {
    side: Side
    y: number
}


const Timber: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [branches, setBranches] = useState<Branch[]>([])
    const [progress, setProgress] = useState<Map<string, number>>(new Map(players.map(p => [p.id, 0])))
    const [playerSides, setPlayerSides] = useState<Map<string, Side>>(new Map(players.map(p => [p.id, 'left'])))
    const [eliminated, setEliminated] = useState<Set<string>>(new Set())
    const [winner, setWinner] = useState<string | null>(null)

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
                        // Generate random branches
                        const newBranches: Branch[] = []
                        for (let i = 0; i < 50; i++) {
                            newBranches.push({
                                side: Math.random() > 0.5 ? 'left' : 'right',
                                y: i
                            })
                        }
                        broadcastAndApply({ type: 'TIMBER_START', branches: newBranches })
                    }
                    return 0
                }
                playCountdownBeep(false)
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [phase, broadcastAndApply])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'TIMBER_START') {
            setBranches(lastBroadcast.branches)
            setPhase('PLAYING')
        }

        if (lastBroadcast.type === 'TIMBER_CHOP') {
            setProgress(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.progress)
                return next
            })
            setPlayerSides(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.playerId, lastBroadcast.side)
                return next
            })
        }

        if (lastBroadcast.type === 'TIMBER_HIT') {
            setEliminated(prev => new Set(prev).add(lastBroadcast.playerId))
            if (lastBroadcast.playerId === currentPlayer?.id) playFail()
        }

        if (lastBroadcast.type === 'TIMBER_GAME_OVER') {
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    const handleChop = useCallback((side: Side) => {
        if (phase !== 'PLAYING' || !currentPlayer || eliminated.has(currentPlayer.id)) return

        const currentProgress = progress.get(currentPlayer.id) || 0
        const nextBranch = branches[currentProgress]

        // Check if we hit a branch
        if (nextBranch && nextBranch.side === side) {
            // Hit! Player is eliminated
            broadcastAndApply({ type: 'TIMBER_HIT', playerId: currentPlayer.id })
            return
        }

        playTap()
        const newProgress = currentProgress + 1
        broadcastAndApply({ type: 'TIMBER_CHOP', playerId: currentPlayer.id, progress: newProgress, side })

        // Check win condition
        if (newProgress >= branches.length && isHost) {
            broadcastAndApply({ type: 'TIMBER_GAME_OVER', winnerId: currentPlayer.id })
        }
    }, [phase, currentPlayer, eliminated, progress, branches, isHost, broadcastAndApply])

    const myProgress = progress.get(currentPlayer?.id || '') || 0
    const mySide = playerSides.get(currentPlayer?.id || '') || 'left'
    const amEliminated = eliminated.has(currentPlayer?.id || '')

    // Get visible branches for the player (next 5)
    const visibleBranches = branches.slice(myProgress, myProgress + 5)

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-green-700 to-green-900 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🪓 TALAR EL ÁRBOL!</h1>
                <p className="text-lg text-green-300">Esquiva las ramas cambiando de lado</p>
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && (
                <div className="flex-1 flex items-center justify-center">
                    {/* Tree */}
                    <div className="relative">
                        {/* Tree trunk */}
                        <div className="w-16 h-64 bg-amber-800 rounded-t-lg relative">
                            {/* Branches coming down */}
                            {visibleBranches.map((branch, i) => (
                                <motion.div
                                    key={myProgress + i}
                                    initial={{ y: -50 }}
                                    animate={{ y: 0 }}
                                    className={clsx(
                                        "absolute w-12 h-4 bg-amber-700",
                                        branch.side === 'left' ? "-left-10" : "-right-10 right-0"
                                    )}
                                    style={{ top: i * 40 + 20 }}
                                />
                            ))}

                            {/* Lumberjack */}
                            {!amEliminated && (
                                <motion.div
                                    animate={{ x: mySide === 'left' ? -30 : 30 }}
                                    className="absolute bottom-0 left-1/2 -translate-x-1/2 text-4xl"
                                >
                                    🪓
                                </motion.div>
                            )}
                            {amEliminated && (
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-4xl">💀</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Progress bars */}
            {phase === 'PLAYING' && (
                <div className="w-full max-w-md mb-4">
                    {players.map(player => {
                        const prog = progress.get(player.id) || 0
                        const isElim = eliminated.has(player.id)

                        return (
                            <div key={player.id} className="mb-2">
                                <div className="flex justify-between text-sm text-white mb-1">
                                    <span>{player.username} {isElim && '💀'}</span>
                                    <span>{prog}/{branches.length}</span>
                                </div>
                                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                                    <motion.div
                                        animate={{ width: `${(prog / branches.length) * 100}%` }}
                                        className={clsx("h-full rounded-full", isElim ? "bg-red-500" : "bg-green-500")}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Controls */}
            {phase === 'PLAYING' && !amEliminated && (
                <div className="flex gap-8 pb-4">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleChop('left')}
                        className={clsx("w-24 h-24 rounded-xl text-3xl", mySide === 'left' ? "bg-green-500" : "bg-gray-600")}>
                        ⬅️ IZQUIERDA
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleChop('right')}
                        className={clsx("w-24 h-24 rounded-xl text-3xl", mySide === 'right' ? "bg-green-500" : "bg-gray-600")}>
                        DERECHA ➡️
                    </motion.button>
                </div>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🪓</div>
                        <div className="text-4xl font-pixel text-green-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default Timber
