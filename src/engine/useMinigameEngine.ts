/**
 * useMinigameEngine - The core game engine hook
 * 
 * This hook provides all the shared functionality for minigames:
 * - Countdown management
 * - Phase transitions
 * - Winner detection
 * - Game end handling
 * - HOST-AUTHORITATIVE STATE SYNC
 * 
 * ALL GAME LOGIC IS DRIVEN BY THE HOST.
 * Guests act as "dumb terminals" that predict/interpolate but ultimately
 * reflect the Host's state.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useGame } from '../context/GameContext'
import { useSyncedState } from './useSyncedState'
import type { MinigamePhase, BaseGameEvent, PlayerResult, MinigameConfig, StateSyncEvent, PhaseChangeEvent } from './types'
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
    lastSyncTimestamp: number // To ignore old syncs
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
    | { type: 'SYNC_STATE'; event: StateSyncEvent<TGameState> }

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
            case 'SYNC_STATE':
                // Only apply if newer than last sync
                if (action.event.timestamp <= state.lastSyncTimestamp) return state

                return {
                    ...state,
                    phase: action.event.phase,
                    timeRemaining: action.event.timeRemaining,
                    gameState: action.event.gameState,
                    gameStartTime: action.event.gameStartTime,
                    // We don't hard-sync countdown to avoid jitter, unless offset is huge
                    countdown: Math.abs(state.countdown - action.event.countdown) > 2 ? action.event.countdown : state.countdown,
                    lastSyncTimestamp: action.event.timestamp
                }
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
    gameDuration?: number  // In milliseconds
}

// ===== THE HOOK =====
export function useMinigameEngine<TGameState = Record<string, any>>(
    options: UseMinigameEngineOptions<TGameState>
) {
    const { players, currentPlayer } = useGame()
    const { dispatch: syncDispatch, isLeader, currentPlayerId } = useSyncedState()

    const countdownDuration = options.config.countdownDuration ?? 3
    const gameDuration = options.gameDuration

    const reducer = createReducer<TGameState>(options.gameReducer)

    const [state, localDispatch] = useReducer(reducer, {
        phase: 'COUNTDOWN', // Everyone starts here. Late joiners will catch up via SYNC.
        countdown: countdownDuration,
        gameStartTime: null,
        timeRemaining: gameDuration ?? null,
        winnerId: null,
        results: null,
        gameState: options.initialGameState,
        lastSyncTimestamp: 0
    })

    const gameEndedRef = useRef(false)
    const { onGameEnd } = useGameEndCallback()

    // Unlock audio on interaction
    useEffect(() => {
        const handleInteraction = () => {
            unlockAudio()
            window.removeEventListener('pointerdown', handleInteraction)
        }
        window.addEventListener('pointerdown', handleInteraction)
        return () => window.removeEventListener('pointerdown', handleInteraction)
    }, [])

    useEffect(() => {
        gameEndedRef.current = false
    }, [])

    // ===== DISPATCH helper =====
    const dispatchGameEvent = useCallback(<T extends Record<string, any>>(
        eventType: string,
        data: T = {} as T
    ) => {
        if (!currentPlayerId) return
        const event: BaseGameEvent & T = {
            type: eventType,
            timestamp: Date.now(),
            senderId: currentPlayerId,
            eventId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...data
        }
        syncDispatch(eventType, { ...data, ...event })
    }, [currentPlayerId, syncDispatch])


    // ===== HOST: PERIODIC SYNC =====
    useEffect(() => {
        // Only Leader broadcasts state
        if (!isLeader) return

        const interval = setInterval(() => {
            // Broadcast Full State
            dispatchGameEvent('SYSTEM_STATE_SYNC', {
                phase: state.phase,
                timeRemaining: state.timeRemaining,
                gameState: state.gameState,
                gameStartTime: state.gameStartTime,
                countdown: state.countdown
            })
        }, 2000) // Sync every 2 seconds to correct drift/late joiners

        return () => clearInterval(interval)
    }, [isLeader, state.phase, state.timeRemaining, state.gameState, state.gameStartTime, state.countdown, dispatchGameEvent])


    // ===== COUNTDOWN LOGIC (Shared Prediction) =====
    useEffect(() => {
        if (state.phase !== 'COUNTDOWN') return

        const interval = setInterval(() => {
            localDispatch({ type: 'SET_COUNTDOWN', value: state.countdown - 1 })

            // Audio feedback
            if (state.countdown > 1) playCountdownBeep(false)
            else if (state.countdown === 1) playCountdownBeep(true)

        }, 1000)

        return () => clearInterval(interval)
    }, [state.phase, state.countdown])

    // ===== HOST: PHASE TRANSITION (Countdown -> Playing) =====
    useEffect(() => {
        if (!isLeader) return // Only Leader authorizes phase change

        if (state.phase === 'COUNTDOWN' && state.countdown <= 0) {
            dispatchGameEvent('SYSTEM_PHASE_CHANGE', { phase: 'PLAYING' })
        }
    }, [isLeader, state.phase, state.countdown, dispatchGameEvent])


    // ===== TIMER LOGIC (Shared Prediction) =====
    useEffect(() => {
        if (state.phase !== 'PLAYING' || !gameDuration || !state.gameStartTime) return

        const interval = setInterval(() => {
            const elapsed = Date.now() - state.gameStartTime!
            const remaining = Math.max(0, gameDuration - elapsed)
            localDispatch({ type: 'SET_TIME_REMAINING', time: remaining })
        }, 100)

        return () => clearInterval(interval)
    }, [state.phase, state.gameStartTime, gameDuration])


    // ===== EVENT PROCESSING =====
    const processEvent = useCallback((event: BaseGameEvent) => {
        // Handle System Events
        if (event.type === 'SYSTEM_STATE_SYNC') {
            localDispatch({ type: 'SYNC_STATE', event: event as StateSyncEvent<TGameState> })
            return
        }

        if (event.type === 'SYSTEM_PHASE_CHANGE') {
            const phaseEvent = event as PhaseChangeEvent
            localDispatch({ type: 'SET_PHASE', phase: phaseEvent.phase })

            if (phaseEvent.phase === 'PLAYING') {
                localDispatch({ type: 'SET_GAME_START_TIME', time: Date.now() })
            }
            return
        }

        if (event.type === 'SYSTEM_GAME_END') {
            const endEvent = event as any
            if (gameEndedRef.current) return
            gameEndedRef.current = true
            localDispatch({ type: 'SET_WINNER', winnerId: endEvent.winnerId, results: endEvent.results })
            // Wait then transition to scoreboard
            setTimeout(() => {
                localDispatch({ type: 'SET_PHASE', phase: 'ENDED' })
                onGameEnd({ winnerId: endEvent.winnerId || undefined })
            }, 3000)
            return
        }

        // Handle Game Events
        localDispatch({ type: 'GAME_EVENT', event })
        if (options.onGameEvent) options.onGameEvent(event)

    }, [options.onGameEvent, onGameEnd])

    // Hook up to sync layer
    useSyncedState({ onEvent: processEvent })


    // ===== END GAME ACTION =====
    const endGame = useCallback((
        winnerId: string | null,
        results: PlayerResult[] = []
    ) => {
        // Only Leader can end game officially
        if (!isLeader || gameEndedRef.current) return

        dispatchGameEvent('SYSTEM_GAME_END', { winnerId, results })
    }, [isLeader, dispatchGameEvent])

    // ===== UPDATE GAME STATE =====
    const updateGameState = useCallback((
        updater: (state: TGameState) => TGameState
    ) => {
        // Optimistic update locally? 
        // For clean architecture and perfect sync, we should maybe dispatch immediately?
        // Current pattern: optimistic.
        localDispatch({ type: 'UPDATE_GAME_STATE', updater })
        // But how do we broadcast? 
        // Logic in games usually calls updateGameState THEN dispatchGameEvent separately? No. 
        // Many games just call `updateGameState`. 
        // WAIT. `updateGameState` in PREVIOUS version only updated LOCAL state!
        // The games were responsible for dispatching events!
        // No, `useMinigameEngine` didn't auto-broadcast state changes.
        // `updateGameState` was local.
        // BUT `useSyncedState` in the games (like `HighNoon`) handled broadcasting events.
        // MOST games use `updateGameState` to update local state optimistically, 
        // AND call `updateGameState` inside event handlers from other players.

        // FOR SYNC: The Host's `SYSTEM_STATE_SYNC` will overwrite everyone's state eventually.
        // So local updates are fine for responsiveness.
    }, [])

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
        if (calledRef.current) return
        // Guest also needs to know game ended? 
        // No, only Host triggers Room Status change usually?
        // Actually, if Host changes room status, valid. 
        // But if Guest runs this, they attempt to write DB.
        if (!currentPlayer?.is_host) return

        calledRef.current = true
        console.log('[ENGINE] Game ended:', results)
        setRoomStatus('SCOREBOARD')
    }, [setRoomStatus, currentPlayer])

    return { onGameEnd }
}

export type { EngineState, EngineAction }
