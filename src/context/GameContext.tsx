import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { GameState, Player, Room } from '../types'
import { RealtimeChannel } from '@supabase/supabase-js'

interface GameContextType extends GameState {
    createRoom: (username: string) => Promise<string | null>
    joinRoom: (code: string, username: string) => Promise<boolean>
    startGame: (gameId?: string) => Promise<void>
    submitScore: (score: number) => Promise<void>
    setRoomStatus: (status: Room['status'], gameId?: string) => Promise<void>
    error: string | null
    broadcastAction: (action: any) => Promise<void>
    broadcastAndApply: (action: any) => Promise<void>
    lastBroadcast: any
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [room, setRoom] = useState<Room | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [channel, setChannel] = useState<RealtimeChannel | null>(null)
    const [lastBroadcast, setLastBroadcast] = useState<any>(null)

    // Subscribe to Room and Players when room is set
    useEffect(() => {
        if (!room) return

        const roomChannel = supabase.channel(`room:${room.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload) => {
                setRoom(payload.new as Room)
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, () => {
                // Refresh players list
                fetchPlayers(room.id)
            })
            .on('broadcast', { event: 'game-event' }, (payload) => {
                setLastBroadcast(payload.payload)
            })
            .subscribe()

        setChannel(roomChannel)
        fetchPlayers(room.id)

        return () => {
            supabase.removeChannel(roomChannel)
        }
    }, [room?.id])

    const fetchPlayers = async (roomId: string) => {
        const { data } = await supabase.from('players').select('*').eq('room_id', roomId)
        if (data) setPlayers(data)
    }

    const createRoom = async (username: string) => {
        try {
            const code = Math.random().toString(36).substring(2, 6).toUpperCase()
            const { data: roomData, error: roomError } = await supabase.from('rooms').insert({
                code,
                status: 'LOBBY'
            }).select().single()

            if (roomError) throw roomError

            const { data: playerData, error: playerError } = await supabase.from('players').insert({
                room_id: roomData.id,
                username,
                is_host: true,
                avatar_id: Math.floor(Math.random() * 8)
            }).select().single()

            if (playerError) throw playerError

            setRoom(roomData)
            setCurrentPlayer(playerData)
            return code
        } catch (e: any) {
            setError(e.message)
            return null
        }
    }

    const joinRoom = async (code: string, username: string) => {
        try {
            const { data: roomData, error: roomError } = await supabase.from('rooms').select('*').eq('code', code).single()
            if (roomError || !roomData) throw new Error('Room not found')

            const { data: playerData, error: playerError } = await supabase.from('players').insert({
                room_id: roomData.id,
                username,
                is_host: false,
                avatar_id: Math.floor(Math.random() * 8)
            }).select().single()

            if (playerError) throw playerError

            setRoom(roomData)
            setCurrentPlayer(playerData)
            return true
        } catch (e: any) {
            setError(e.message)
            return false
        }
    }

    // Broadcast to others AND apply to self (fixes echo issue)
    const broadcastAndApply = async (action: any) => {
        // 1. Apply locally FIRST (so sender sees it immediately)
        setLastBroadcast(action)

        // 2. Then broadcast to others
        if (channel) {
            await channel.send({
                type: 'broadcast',
                event: 'game-event',
                payload: action
            })
        }
    }

    // Legacy function for backward compatibility (just broadcasts, no local apply)
    const broadcastAction = async (action: any) => {
        if (channel) {
            await channel.send({
                type: 'broadcast',
                event: 'game-event',
                payload: action
            })
        }
    }

    const setRoomStatus = async (status: Room['status'], gameId?: string) => {
        if (!room) return
        await supabase.from('rooms').update({ status, current_game_id: gameId || room.current_game_id }).eq('id', room.id)
    }

    const startGame = async (specificGameId?: string) => {
        // Logic to pick random game and set status
        if (!room) return

        let gameId = specificGameId

        if (!gameId) {
            // Import registry and pick random game suitable for player count
            const { getRandomMinigameForPlayers } = await import('../features/minigames/MinigameRegistry')
            gameId = getRandomMinigameForPlayers(players.length) || 'high-noon'
        }

        console.log(`[GAME] Starting minigame: ${gameId} for ${players.length} players`)
        await setRoomStatus('INSTRUCTIONS', gameId)
    }

    const submitScore = async (points: number) => {
        if (!currentPlayer) return
        await supabase.from('players').update({ score: currentPlayer.score + points }).eq('id', currentPlayer.id)
    }

    return (
        <GameContext.Provider value={{
            room, players, currentPlayer, minigame: room?.current_game_id || null,
            createRoom, joinRoom, startGame, submitScore, setRoomStatus, error,
            broadcastAction, broadcastAndApply, lastBroadcast
        }}>
            {children}
        </GameContext.Provider>
    )
}

export const useGame = () => {
    const context = useContext(GameContext)
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider')
    }
    return context
}
