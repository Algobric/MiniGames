export interface Player {
    id: string
    username: string
    avatar_id: number
    score: number
    is_host: boolean
    last_seen?: string
    latency?: number        // Estimated RTT in ms
    isSpectating?: boolean  // True if eliminated/disqualified
}

export interface Room {
    id: string
    code: string
    status: 'LOBBY' | 'INSTRUCTIONS' | 'PLAYING' | 'SCOREBOARD'
    current_game_id: string | null
}

export interface MinigameProps {
    players: Player[]
    onGameEnd: (results: { winnerId?: string; loserIds?: string[] }) => void
    difficulty: 'easy' | 'medium' | 'hard'
}

export interface GameState {
    room: Room | null
    players: Player[]
    currentPlayer: Player | null
    minigame: string | null
}

// Game event types for type safety
export type GameEventType =
    // Timing/sync events
    | 'TIMING_PING'
    | 'TIMING_PONG'
    | 'SYNCED_COUNTDOWN'
    // HighNoon events
    | 'SIGNAL_DRAW'
    | 'SHOOT'
    | 'MISFIRE'
    | 'GAME_RESULT'
    // ButtonMash events
    | 'MASH_START'
    | 'MASH_TAP'
    | 'MASH_FINAL'
    | 'MASH_RESULT'
    // ColorMatch events
    | 'COLOR_NEW_ROUND'
    | 'COLOR_ANSWER'
    | 'COLOR_GAME_OVER'
    // MemoryFlash events
    | 'MEMORY_NEW_ROUND'
    | 'MEMORY_PLAYER_RESULT'
    | 'MEMORY_ROUND_END'
    | 'MEMORY_GAME_OVER'

export interface GameEvent {
    type: GameEventType
    [key: string]: any
}
