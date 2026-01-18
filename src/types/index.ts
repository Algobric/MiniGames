export interface Player {
    id: string
    username: string
    avatar_id: number
    score: number
    is_host: boolean
    last_seen?: string
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
