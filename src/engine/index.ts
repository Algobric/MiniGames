/**
 * Game Engine - Barrel exports
 * 
 * Import from '@/engine' to access all game engine functionality.
 */

// Types
export type {
    MinigamePhase,
    BaseGameEvent,
    CountdownStartEvent,
    GameEndEvent,
    PlayerResult,
    PlayerActionEvent,
    MinigameConfig,
    MinigameEngineState,
    GameEventHandler,
    MinigameDefinition
} from './types'

// Hooks
export { useMinigameEngine } from './useMinigameEngine'
export { useSyncedState, generateEventId } from './useSyncedState'

// Components
export { MinigameWrapper, PlayerScoreBar } from './MinigameWrapper'
