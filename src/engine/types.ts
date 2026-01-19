/**
 * Shared types for the minigame engine.
 * All games use these types for consistent behavior.
 */

// ===== GAME PHASES =====
export type MinigamePhase =
    | 'INITIALIZING'  // Setting up, waiting for all players
    | 'COUNTDOWN'     // 3, 2, 1...
    | 'PLAYING'       // Game in progress
    | 'ENDING'        // Showing results
    | 'ENDED'         // Final state

// ===== BASE EVENT TYPES =====
export interface BaseGameEvent {
    type: string
    timestamp: number      // When event occurred (server-adjusted)
    senderId: string       // Who sent it
    eventId: string        // Unique ID for deduplication
}

// ===== SYSTEM EVENTS (handled by engine) =====
export interface CountdownStartEvent extends BaseGameEvent {
    type: 'SYSTEM_COUNTDOWN_START'
    startTime: number      // When game should start
}

export interface GameEndEvent extends BaseGameEvent {
    type: 'SYSTEM_GAME_END'
    winnerId: string | null
    results: PlayerResult[]
    message?: string
}

export interface PlayerResult {
    playerId: string
    score: number
    rank: number
    metadata?: Record<string, any>
}

// ===== PLAYER EVENTS (specific to each game) =====
export interface PlayerActionEvent extends BaseGameEvent {
    type: string  // Game-specific action type
    playerId: string
    data: Record<string, any>
}

// ===== GAME CONFIG =====
export interface MinigameConfig {
    id: string
    name: string
    icon: string
    instructions: string
    minPlayers: number
    maxPlayers: number
    countdownDuration: number  // Seconds
    gameDuration?: number      // Optional: for timed games
}

// ===== ENGINE STATE =====
export interface MinigameEngineState<TGameState = Record<string, any>> {
    phase: MinigamePhase
    countdown: number
    timeRemaining: number | null
    gameState: TGameState
    results: PlayerResult[] | null
    winnerId: string | null
}

// ===== EVENT HANDLER =====
export type GameEventHandler<TEvent extends BaseGameEvent = BaseGameEvent> =
    (event: TEvent, dispatch: (event: Omit<BaseGameEvent, 'timestamp' | 'senderId' | 'eventId'>) => void) => void

// ===== GAME DEFINITION =====
export interface MinigameDefinition<TGameState = Record<string, any>> {
    config: MinigameConfig
    initialState: (players: string[]) => TGameState
    reducer: (state: TGameState, event: BaseGameEvent) => TGameState
    getWinner?: (state: TGameState) => string | null
    getResults?: (state: TGameState) => PlayerResult[]
}
