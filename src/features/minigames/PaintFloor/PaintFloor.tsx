/**
 * PaintFloor - Color the grid!
 * REFACTORED TO USE THE NEW GAME ENGINE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMinigameEngine, MinigameWrapper } from '../../../engine'
import clsx from 'clsx'
import { playWinFanfare } from '../HighNoon/sounds'

const GRID_SIZE = 10
const GAME_DURATION = 15

interface PaintFloorState {
    grid: Map<string, string> // cellKey "row,col" -> playerId
}

const PaintFloor = () => {
    const engine = useMinigameEngine<PaintFloorState>({
        config: {
            countdownDuration: 3,
            gameDuration: GAME_DURATION
        },
        initialGameState: {
            grid: new Map()
        }
    })

    const {
        phase,
        countdown,
        timeRemaining,
        gameState,
        winnerId,
        isPlaying,
        currentPlayerId,
        players,
        updateGameState,
        endGame
    } = engine

    const isLeader = players.length > 0 && players[0].id === currentPlayerId
    const containerRef = useRef<HTMLDivElement>(null)
    const isDrawingRef = useRef(false)
    const gameEndedRef = useRef(false)

    // Game Over
    useEffect(() => {
        if (!isPlaying || !isLeader || winnerId || gameEndedRef.current) return

        if (timeRemaining !== null && timeRemaining <= 0) {
            gameEndedRef.current = true

            // Count scores
            const counts = new Map<string, number>()
            players.forEach(p => counts.set(p.id, 0))
            gameState.grid.forEach(pid => {
                counts.set(pid, (counts.get(pid) || 0) + 1)
            })

            let bestId = players[0].id
            let maxCount = -1
            counts.forEach((count, pid) => {
                if (count > maxCount) {
                    maxCount = count
                    bestId = pid
                }
            })

            if (bestId === currentPlayerId) playWinFanfare()
            endGame(bestId)
        }
    }, [timeRemaining, isPlaying, isLeader, winnerId, gameState.grid, players, currentPlayerId, endGame])


    const paintCell = useCallback((row: number, col: number) => {
        if (!isPlaying || !currentPlayerId) return
        const cellKey = `${row},${col}`

        // Optimistic check to avoid spamming
        if (gameState.grid.get(cellKey) === currentPlayerId) return

        updateGameState(state => ({
            ...state,
            grid: new Map([...state.grid, [cellKey, currentPlayerId]])
        }))
    }, [isPlaying, currentPlayerId, gameState.grid, updateGameState])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDrawingRef.current || !isPlaying) return

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
    }, [isPlaying, paintCell])

    const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#DDA0DD', '#87CEEB', '#FFA07A', '#90EE90']

    return (
        <MinigameWrapper
            phase={phase}
            countdown={countdown}
            winnerId={winnerId}
            timeRemaining={timeRemaining}
            backgroundColor="bg-gradient-to-b from-purple-800 to-purple-950"
        >
            <div className="flex flex-col items-center justify-between w-full h-full p-4 select-none touch-none">
                <div className="text-center pt-2">
                    <h1 className="text-3xl font-pixel text-white" style={{ textShadow: '0 2px 0 #000' }}>
                        🎨 PAINT FLOOR!
                    </h1>
                </div>

                {isPlaying && (
                    <div
                        ref={containerRef}
                        className="grid bg-white/10 rounded-lg overflow-hidden shadow-2xl cursor-crosshair touch-none"
                        style={{
                            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                            width: 'min(90vw, 400px)',
                            height: 'min(90vw, 400px)'
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
                            const ownerId = gameState.grid.get(cellKey)
                            const ownerIndex = ownerId ? players.findIndex(p => p.id === ownerId) : -1

                            return (
                                <div
                                    key={cellKey}
                                    className="border border-white/5"
                                    style={{
                                        backgroundColor: ownerIndex >= 0 ? PLAYER_COLORS[ownerIndex % PLAYER_COLORS.length] : 'transparent',
                                    }}
                                />
                            )
                        })}
                    </div>
                )}

                {/* Scores */}
                <div className="flex flex-wrap justify-center gap-4">
                    {players.map((p, idx) => {
                        const score = [...gameState.grid.values()].filter(id => id === p.id).length
                        return (
                            <div key={p.id} className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: PLAYER_COLORS[idx % PLAYER_COLORS.length] }} />
                                <span className="text-white text-sm font-pixel">{p.username}: {score}</span>
                            </div>
                        )
                    })}
                </div>

            </div>
        </MinigameWrapper>
    )
}

export default PaintFloor
