import { useEffect, useRef, useCallback, useState } from 'react'
import { useGame } from '../context/GameContext'

interface LatencySample {
    rtt: number
    timestamp: number
}

const MAX_SAMPLES = 10
const PING_INTERVAL = 2000 // 2 seconds between pings

/**
 * Hook for fair timing in multiplayer games.
 * 
 * Problem: When using Date.now() on each client, the host has an advantage
 * because their events don't travel over the network - they're processed locally.
 * 
 * Solution: Each client estimates their RTT (Round Trip Time) to adjust timestamps.
 * When reporting a timestamp, we subtract half the RTT to estimate when the action
 * actually occurred from the server's perspective.
 * 
 * For HighNoon-style games:
 * - Host broadcasts DRAW signal with their timestamp
 * - Clients receive it with some delay (half their RTT)
 * - When clients shoot, they use getServerTimestamp() which adjusts for their latency
 * - Host compares all adjusted timestamps fairly
 */
export function useFairTiming() {
    const { broadcastAction, lastBroadcast, currentPlayer } = useGame()
    const samplesRef = useRef<LatencySample[]>([])
    const pendingPingsRef = useRef<Map<string, number>>(new Map())
    const [estimatedRtt, setEstimatedRtt] = useState(0)
    const isHost = currentPlayer?.is_host ?? false

    // Process incoming pong messages
    useEffect(() => {
        if (!lastBroadcast) return

        // Handle PONG response (measure RTT)
        if (lastBroadcast.type === 'TIMING_PONG' && lastBroadcast.targetPlayerId === currentPlayer?.id) {
            const pingId = lastBroadcast.pingId
            const sentTime = pendingPingsRef.current.get(pingId)
            
            if (sentTime) {
                const rtt = Date.now() - sentTime
                pendingPingsRef.current.delete(pingId)
                
                // Add sample
                samplesRef.current.push({
                    rtt,
                    timestamp: Date.now()
                })
                
                // Keep only recent samples
                if (samplesRef.current.length > MAX_SAMPLES) {
                    samplesRef.current.shift()
                }
                
                // Calculate median RTT (more stable than average)
                const sortedRtts = [...samplesRef.current].map(s => s.rtt).sort((a, b) => a - b)
                const median = sortedRtts[Math.floor(sortedRtts.length / 2)]
                setEstimatedRtt(median)
            }
        }

        // Handle PING request (respond with PONG)
        if (lastBroadcast.type === 'TIMING_PING' && lastBroadcast.targetPlayerId === currentPlayer?.id) {
            broadcastAction({
                type: 'TIMING_PONG',
                pingId: lastBroadcast.pingId,
                targetPlayerId: lastBroadcast.fromPlayerId
            })
        }
    }, [lastBroadcast, currentPlayer?.id, broadcastAction])

    // Periodically send pings to measure latency (only non-hosts need this)
    useEffect(() => {
        if (isHost) {
            // Host doesn't need to ping - their latency is effectively 0
            setEstimatedRtt(0)
            return
        }

        const sendPing = () => {
            if (!currentPlayer) return
            
            const pingId = `ping_${Date.now()}_${Math.random().toString(36).slice(2)}`
            pendingPingsRef.current.set(pingId, Date.now())
            
            // Ping the host (they will respond)
            broadcastAction({
                type: 'TIMING_PING',
                pingId,
                fromPlayerId: currentPlayer.id,
                targetPlayerId: 'host' // Special marker - host will respond
            })
        }

        // Initial ping
        sendPing()
        
        // Continue pinging periodically
        const interval = setInterval(sendPing, PING_INTERVAL)
        return () => clearInterval(interval)
    }, [isHost, currentPlayer, broadcastAction])

    // Host responds to pings
    useEffect(() => {
        if (!isHost || !lastBroadcast) return

        if (lastBroadcast.type === 'TIMING_PING' && lastBroadcast.targetPlayerId === 'host') {
            broadcastAction({
                type: 'TIMING_PONG',
                pingId: lastBroadcast.pingId,
                targetPlayerId: lastBroadcast.fromPlayerId
            })
        }
    }, [isHost, lastBroadcast, broadcastAction])

    /**
     * Get a timestamp adjusted for network latency.
     * This estimates when the action occurred from the server/host's perspective.
     * 
     * The adjustment is: actual_time - (RTT / 2)
     * Because we assume the one-way latency is half the round-trip time.
     */
    const getServerTimestamp = useCallback(() => {
        const now = Date.now()
        const adjustment = Math.floor(estimatedRtt / 2)
        return now - adjustment
    }, [estimatedRtt])

    /**
     * Get the estimated one-way latency to the host
     */
    const getOneWayLatency = useCallback(() => {
        return Math.floor(estimatedRtt / 2)
    }, [estimatedRtt])

    return {
        estimatedRtt,
        getServerTimestamp,
        getOneWayLatency,
        isCalibrated: samplesRef.current.length >= 3 || isHost
    }
}

/**
 * Synchronize a countdown across all clients.
 * Returns the synced start time that all clients should use.
 */
export function useSyncedCountdown() {
    const { broadcastAndApply, lastBroadcast, currentPlayer } = useGame()
    const [syncedStartTime, setSyncedStartTime] = useState<number | null>(null)
    const isHost = currentPlayer?.is_host ?? false

    useEffect(() => {
        if (!lastBroadcast) return

        if (lastBroadcast.type === 'SYNCED_COUNTDOWN') {
            setSyncedStartTime(lastBroadcast.startTime)
        }
    }, [lastBroadcast])

    const startCountdown = useCallback((delayMs: number = 3000) => {
        if (!isHost) return
        
        const startTime = Date.now() + delayMs
        broadcastAndApply({
            type: 'SYNCED_COUNTDOWN',
            startTime
        })
    }, [isHost, broadcastAndApply])

    return {
        syncedStartTime,
        startCountdown,
        isHost
    }
}
