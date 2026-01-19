/**
 * useMinigameEngine - The core game engine hook
 * 
 * This hook provides all the shared functionality for minigames:
 * - Countdown management
 * - Phase transitions
 * - Winner detection
 * - Game end handling
 * 
 * ALL GAME LOGIC RUNS IDENTICALLY ON ALL CLIENTS.
 * There is no "host" vs "guest" distinction in game logic.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useGame } from '../context/GameContext'
import { useSyncedState } from './useSyncedState'
import type { MinigamePhase, BaseGameEvent, PlayerResult, MinigameConfig } from './types'
import { playCountdownBeep, unlockAudio } from '../features/minigames/HighNoon/sounds'

// ===== ENGINE STATE =====
interface EngineState<TGameState> {
    phase: MinigamePhase
    countdown: number
    gameStartTime: number | null
    timeRemaining: number | null
    winnerId: string | null
    results: PlayerResult[] | null
    gameState: TGameState
}

// ===== ENGINE ACTIONS =====
type EngineAction<TGameState> =
    | { type: 'SET_PHASE'; phase: MinigamePhase }
    | { type: 'SET_COUNTDOWN'; value: number }
    | { type: 'SET_GAME_START_TIME'; time: number }
    | { type: 'SET_TIME_REMAINING'; time: number | null }
    | { type: 'SET_WINNER'; winnerId: string | null; results: PlayerResult[] }
    | { type: 'UPDATE_GAME_STATE'; updater: (state: TGameState) => TGameState }
    | { type: 'GAME_EVENT'; event: BaseGameEvent }

function createReducer<TGameState>(
    gameReducer?: (state: TGameState, event: BaseGameEvent) => TGameState
) {
    return function reducer(
        state: EngineState<TGameState>,
        action: EngineAction<TGameState>
    ): EngineState<TGameState> {
        switch (action.type) {
            case 'SET_PHASE':
                return { ...state, phase: action.phase }
            case 'SET_COUNTDOWN':
                return { ...state, countdown: action.value }
            case 'SET_GAME_START_TIME':
                return { ...state, gameStartTime: action.time }
            case 'SET_TIME_REMAINING':
                return { ...state, timeRemaining: action.time }
            case 'SET_WINNER':
                return { ...state, winnerId: action.winnerId, results: action.results, phase: 'ENDING' }
            case 'UPDATE_GAME_STATE':
                return { ...state, gameState: action.updater(state.gameState) }
            case 'GAME_EVENT':
                if (gameReducer) {
                    return { ...state, gameState: gameReducer(state.gameState, action.event) }
                }
                return state
            default:
                return state
        }
    }
}

// ===== ENGINE OPTIONS =====
interface UseMinigameEngineOptions<TGameState> {
    config: Partial<MinigameConfig>
    initialGameState: TGameState
    gameReducer?: (state: TGameState, event: BaseGameEvent) => TGameState
    onGameEvent?: (event: BaseGameEvent) => void
    gameDuration?: number  // In milliseconds, for timed games
}

// ===== THE HOOK =====
export function useMinigameEngine<TGameState = Record<string, any>>(
    options: UseMinigameEngineOptions<TGameState>
) {
    const { players, currentPlayer } = useGame()
    const { dispatch: syncDispatch, isLeader, currentPlayerId } = useSyncedState()

    const countdownDuration = options.config.countdownDuration ?? 3
    const gameDuration = options.gameDuration

    // Create reducer with game-specific logic
    const reducer = createReducer<TGameState>(options.gameReducer)

    const [state, localDispatch] = useReducer(reducer, {
        phase: 'COUNTDOWN',
        countdown: countdownDuration,
        gameStartTime: null,
        timeRemaining: gameDuration ?? null,
        winnerId: null,
        results: null,
        gameState: options.initialGameState
    })

    const gameEndedRef = useRef(false)
    const { onGameEnd } = useGameEndCallback()

    // Unlock audio on first interaction
    useEffect(() => {
        const handleInteraction = () => {
            unlockAudio()
            window.removeEventListener('pointerdown', handleInteraction)
        }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    // Reset on mount
    useEffect(() => {
        gameEndedRef.current = false
    }, [])

    // ===== COUNTDOWN LOGIC =====
    // All clients run this - no host check!
    useEffect(() => {
        if (state.phase !== 'COUNTDOWN') return

        const interval = setInterval(() => {
            localDispatch({ type: 'SET_COUNTDOWN', value: state.countdown - 1 })

            if (state.countdown > 1) {
                playCountdownBeep(false)
            } else if (state.countdown === 1) {
                playCountdownBeep(true)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [state.phase, state.countdown])

    // Transition to PLAYING when countdown ends
    useEffect(() => {
        if (state.phase === 'COUNTDOWN' && state.countdown <= 0) {
            localDispatch({ type: 'SET_PHASE', phase: 'PLAYING' })
            localDispatch({ type: 'SET_GAME_START_TIME', time: Date.now() })
        }
    }, [state.phase, state.countdown])

    // ===== GAME TIMER (for timed games) =====
    useEffect(() => {
        if (state.phase !== 'PLAYING' || !gameDuration || !state.gameStartTime) return

        const interval = setInterval(() => {
            const elapsed = Date.now() - state.gameStartTime!
            const remaining = Math.max(0, gameDuration - elapsed)
            localDispatch({ type: 'SET_TIME_REMAINING', time: remaining })

            if (remaining <= 0 && !gameEndedRef.current) {
                clearInterval(interval)
            }
        }, 50)

        return () => clearInterval(interval)
    }, [state.phase, state.gameStartTime, gameDuration])

    // ===== DISPATCH GAME EVENT =====
    const dispatchGameEvent = useCallback(<T extends Record<string, any>>(
        eventType: string,
        data: T = {} as T
    ) => {
        if (!currentPlayerId) return

        // Create event with metadata
        const event: BaseGameEvent & T = {
            type: eventType,
            timestamp: Date.now(),
            senderId: currentPlayerId,
            eventId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...data
        }

        // Dispatch via sync layer (all clients receive)
        syncDispatch(eventType, { ...data, ...event })
    }, [currentPlayerId, syncDispatch])

    // ===== END GAME =====
    const endGame = useCallback((
        winnerId: string | null,
        results: PlayerResult[] = []
    ) => {
        if (gameEndedRef.current) return
        gameEndedRef.current = true

        localDispatch({ type: 'SET_WINNER', winnerId, results })

        // All clients show results, then the leader triggers onGameEnd
        setTimeout(() => {
            localDispatch({ type: 'SET_PHASE', phase: 'ENDED' })

            // Any client can call onGameEnd - the first one wins
            // This is deterministic because all clients have the same winnerId
            onGameEnd({ winnerId: winnerId || undefined })
        }, 3000)
    }, [onGameEnd])

    // ===== UPDATE GAME STATE =====
    const updateGameState = useCallback((
        updater: (state: TGameState) => TGameState
    ) => {
        localDispatch({ type: 'UPDATE_GAME_STATE', updater })
    }, [])

    // ===== PROCESS INCOMING EVENTS =====
    const processEvent = useCallback((event: BaseGameEvent) => {
        // Apply to game state
        localDispatch({ type: 'GAME_EVENT', event })

        // Call custom handler
        if (options.onGameEvent) {
            options.onGameEvent(event)
        }
    }, [options.onGameEvent])

    return {
        // State
        phase: state.phase,
        countdown: state.countdown,
        timeRemaining: state.timeRemaining,
        gameState: state.gameState,
        winnerId: state.winnerId,
        results: state.results,
        isPlaying: state.phase === 'PLAYING',
        isEnded: state.phase === 'ENDED' || state.phase === 'ENDING',

        // Player info
        players,
        currentPlayer,
        currentPlayerId,
        isLeader,

        // Actions
        dispatchGameEvent,
        endGame,
        updateGameState,
        processEvent
    }
}

// ===== HELPER HOOK FOR GAME END =====
function useGameEndCallback() {
    const { setRoomStatus, currentPlayer } = useGame()
    const calledRef = useRef(false)

    const onGameEnd = useCallback((results: { winnerId?: string }) => {
        // Only call once, and only if we're the leader (to avoid duplicate DB calls)
        if (calledRef.current) return
        if (!currentPlayer?.is_host) return

        calledRef.current = true
        console.log('[ENGINE] Game ended:', results)

        // Transition to scoreboard
        setRoomStatus('SCOREBOARD')
    }, [setRoomStatus, currentPlayer])

    return { onGameEnd }
}

// ===== BARREL EXPORT =====
export type { EngineState, EngineAction }
