import { useEffect, useState, useCallback, useRef } from 'react'
import type { MinigameProps } from '../../../types'
import { useGame } from '../../../context/GameContext'
import { motion } from 'framer-motion'
import { playCountdownBeep, playWinFanfare, unlockAudio } from '../HighNoon/sounds'

type Phase = 'COUNTDOWN' | 'PLAYING' | 'ENDED'

const GRID_SIZE = 10
const GAME_DURATION = 10000

const PaintFloor: React.FC<MinigameProps> = ({ players, onGameEnd }) => {
    const { currentPlayer, broadcastAndApply, lastBroadcast } = useGame()

    const [phase, setPhase] = useState<Phase>('COUNTDOWN')
    const [countdown, setCountdown] = useState(3)
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
    const [grid, setGrid] = useState<Map<string, string>>(new Map())
    const [winner, setWinner] = useState<string | null>(null)
    const [scores, setScores] = useState<Map<string, number>>(new Map())

    const isHost = players.find(p => p.id === currentPlayer?.id)?.is_host ?? false
    const isHostRef = useRef(isHost)
    isHostRef.current = isHost
    const containerRef = useRef<HTMLDivElement>(null)
    const isDrawingRef = useRef(false)

    // Reset refs on mount
    useEffect(() => {
        isDrawingRef.current = false
    }, [])

    useEffect(() => {
        const handleInteraction = () => { unlockAudio(); window.removeEventListener('pointerdown', handleInteraction) }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    useEffect(() => {
        if (phase !== 'COUNTDOWN') return
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(interval); playCountdownBeep(true); setPhase('PLAYING'); return 0 }
                playCountdownBeep(false); return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [phase])

    useEffect(() => {
        if (phase !== 'PLAYING') return
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 100) {
                    clearInterval(interval)
                    if (isHostRef.current) calculateWinner()
                    return 0
                }
                return prev - 100
            })
        }, 100)
        return () => clearInterval(interval)
    }, [phase])

    const calculateWinner = useCallback(() => {
        const counts = new Map<string, number>()
        players.forEach(p => counts.set(p.id, 0))

        grid.forEach((playerId) => {
            counts.set(playerId, (counts.get(playerId) || 0) + 1)
        })

        let winnerId = players[0]?.id
        let maxCount = 0
        counts.forEach((count, playerId) => {
            if (count > maxCount) { maxCount = count; winnerId = playerId }
        })

        broadcastAndApply({ type: 'PAINT_GAME_OVER', winnerId, scores: Object.fromEntries(counts) })
    }, [grid, players, broadcastAndApply])

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'PAINT_CELL') {
            setGrid(prev => {
                const next = new Map(prev)
                next.set(lastBroadcast.cell, lastBroadcast.playerId)
                return next
            })
        }

        if (lastBroadcast.type === 'PAINT_GAME_OVER') {
            setPhase('ENDED'); setWinner(lastBroadcast.winnerId)
            setScores(new Map(Object.entries(lastBroadcast.scores)))
            if (lastBroadcast.winnerId === currentPlayer?.id) playWinFanfare()
            if (isHost) setTimeout(() => onGameEnd({ winnerId: lastBroadcast.winnerId }), 3000)
        }
    }, [lastBroadcast, currentPlayer?.id, isHost, onGameEnd])

    const paintCell = useCallback((row: number, col: number) => {
        if (phase !== 'PLAYING' || !currentPlayer) return
        const cellKey = `${row},${col}`
        broadcastAndApply({ type: 'PAINT_CELL', cell: cellKey, playerId: currentPlayer.id })
    }, [phase, currentPlayer, broadcastAndApply])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDrawingRef.current || phase !== 'PLAYING') return

        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return

        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const cellSize = rect.width / GRID_SIZE
        const col = Math.floor(x / cellSize)
        const row = Math.floor(y / cellSize)

        if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
            paintCell(row, col)
        }
    }, [phase, paintCell])

    const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#DDA0DD', '#87CEEB', '#FFA07A', '#90EE90']

    return (
        <div className="flex flex-col items-center justify-between w-full h-full bg-gradient-to-b from-purple-800 to-purple-950 select-none p-4">
            <div className="text-center pt-2">
                <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>🎨 PINTA EL PISO!</h1>
                {phase === 'PLAYING' && <div className="text-xl text-yellow-400">{(timeLeft / 1000).toFixed(1)}s</div>}
            </div>

            {phase === 'COUNTDOWN' && (
                <motion.div key={countdown} initial={{ scale: 2 }} animate={{ scale: 1 }} className="text-8xl font-pixel text-yellow-400">{countdown}</motion.div>
            )}

            {phase !== 'COUNTDOWN' && (
                <>
                    <div
                        ref={containerRef}
                        className="grid bg-white/10 rounded-lg overflow-hidden touch-none"
                        style={{
                            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                            width: 'min(80vw, 400px)',
                            height: 'min(80vw, 400px)'
                        }}
                        onPointerDown={(e) => { isDrawingRef.current = true; handlePointerMove(e) }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={() => { isDrawingRef.current = false }}
                        onPointerLeave={() => { isDrawingRef.current = false }}
                    >
                        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                            const row = Math.floor(i / GRID_SIZE)
                            const col = i % GRID_SIZE
                            const cellKey = `${row},${col}`
                            const ownerId = grid.get(cellKey)
                            const ownerIndex = ownerId ? players.findIndex(p => p.id === ownerId) : -1

                            return (
                                <div
                                    key={cellKey}
                                    className="border border-white/10"
                                    style={{
                                        backgroundColor: ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex % PLAYER_COLORS.length] : 'transparent',
                                        aspectRatio: '1'
                                    }}
                                />
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex gap-4 mt-4">
                        {players.map((player, idx) => {
                            const score = scores.get(player.id) || [...grid.values()].filter(id => id === player.id).length
                            return (
                                <div key={player.id} className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded" style={{ backgroundColor: PLAYER_COLORS[idx] }} />
                                    <span className="text-white text-sm">{player.username}: {score}</span>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {phase === 'ENDED' && winner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🎨</div>
                        <div className="text-4xl font-pixel text-pink-400">
                            {players.find(p => p.id === winner)?.username} GANA!
                        </div>
                        <div className="text-xl text-white/70 mt-2">
                            {scores.get(winner) || 0} celdas pintadas
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default PaintFloor
