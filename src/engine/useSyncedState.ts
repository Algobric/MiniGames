/**
 * useSyncedState - Core synchronization hook
 * 
 * This hook provides synchronized state across all clients with NO distinction
 * between "host" and "guest". All clients run the same logic and receive
 * the same events, producing identical state.
 * 
 * Key principles:
 * 1. All events are broadcast to all clients (including sender)
 * 2. All clients apply events in the same order
 * 3. No special "host" logic - just "leader" for UI (who presses start)
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'
import type { BaseGameEvent } from './types'

interface SyncedStateOptions {
    onEvent?: (event: BaseGameEvent) => void
}

export function useSyncedState(options: SyncedStateOptions = {}) {
    const { currentPlayer, broadcastAndApply, lastBroadcast, players } = useGame()
    const processedEventsRef = useRef<Set<string>>(new Set())
    const [isLeader] = useState(() => {
        // Leader is the first player in the room (by creation order)
        // This is purely for UI purposes (pressing start button)
        return players.length > 0 && players[0]?.id === currentPlayer?.id
    })

    // Process incoming events
    useEffect(() => {
        if (!lastBroadcast || !lastBroadcast.eventId) return

        // Deduplicate events
        if (processedEventsRef.current.has(lastBroadcast.eventId)) {
            return
        }
        processedEventsRef.current.add(lastBroadcast.eventId)

        // Call event handler
        if (options.onEvent) {
            options.onEvent(lastBroadcast as BaseGameEvent)
        }
    }, [lastBroadcast, options.onEvent])

    /**
     * Dispatch an event to all clients (including self)
     * The event will be processed by everyone identically
     */
    const dispatch = useCallback(<T extends Record<string, any>>(
        eventType: string,
        data: T = {} as T
    ) => {
        if (!currentPlayer) return

        const event: BaseGameEvent & T = {
            type: eventType,
            timestamp: Date.now(),
            senderId: currentPlayer.id,
            eventId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...data
        }

        broadcastAndApply(event)
    }, [currentPlayer, broadcastAndApply])

    /**
     * Get a timestamp adjusted for fair comparison
     * Uses the current time (all clients should have reasonably synced clocks)
     */
    const getTimestamp = useCallback(() => {
        return Date.now()
    }, [])

    return {
        dispatch,
        getTimestamp,
        isLeader,
        currentPlayerId: currentPlayer?.id ?? null,
        players
    }
}

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
