import React from 'react'
import type { MinigameProps } from '../../types'

export type MinigameComponent = React.ComponentType<MinigameProps>

export interface MinigameEntry {
    component: React.LazyExoticComponent<MinigameComponent> | MinigameComponent
    name: string
    instructions: string
    icon: string
    minPlayers: number
    maxPlayers: number
}

export const MINIGAME_REGISTRY: Record<string, MinigameEntry> = {
    // ===== REACTION GAMES =====
    'high-noon': {
        component: React.lazy(() => import('./HighNoon/HighNoon')),
        name: '🤠 HIGH NOON',
        instructions: 'WAIT FOR "FIRE!" THEN TAP FIRST TO WIN!',
        icon: '🤠',
        minPlayers: 2,
        maxPlayers: 8
    },
    'reaction-race': {
        component: React.lazy(() => import('./ReactionRace/ReactionRace')),
        name: '⚡ REACTION RACE',
        instructions: 'TAP THE TARGET AS FAST AS YOU CAN! 5 ROUNDS!',
        icon: '⚡',
        minPlayers: 2,
        maxPlayers: 8
    },

    // ===== TAPPING GAMES =====
    'button-mash': {
        component: React.lazy(() => import('./ButtonMash/ButtonMash')),
        name: '👆 BUTTON MASH',
        instructions: 'TAP AS FAST AS YOU CAN FOR 5 SECONDS!',
        icon: '👆',
        minPlayers: 2,
        maxPlayers: 8
    },

    // ===== PUZZLE GAMES =====
    'color-match': {
        component: React.lazy(() => import('./ColorMatch/ColorMatch')),
        name: '🎨 COLOR MATCH',
        instructions: 'TAP THE COLOR SHOWN - WATCH OUT FOR TRICKS!',
        icon: '🎨',
        minPlayers: 2,
        maxPlayers: 8
    },
    'memory-flash': {
        component: React.lazy(() => import('./MemoryFlash/MemoryFlash')),
        name: '🧠 MEMORY FLASH',
        instructions: 'REPEAT THE COLOR SEQUENCE - LAST ONE STANDING WINS!',
        icon: '🧠',
        minPlayers: 2,
        maxPlayers: 8
    },
    'number-crunch': {
        component: React.lazy(() => import('./NumberCrunch/NumberCrunch')),
        name: '🔢 NUMBER CRUNCH',
        instructions: 'SOLVE MATH PROBLEMS FAST! 30 SECONDS!',
        icon: '🔢',
        minPlayers: 2,
        maxPlayers: 8
    },

    // ===== ACTION GAMES =====
    'tank-battle': {
        component: React.lazy(() => import('./TankBattle/TankBattle')),
        name: '🎖️ TANK BATTLE',
        instructions: 'MOVE AND SHOOT! HIT YOUR OPPONENT TO SCORE!',
        icon: '🎖️',
        minPlayers: 2,
        maxPlayers: 4
    },
    'target-shoot': {
        component: React.lazy(() => import('./TargetShoot/TargetShoot')),
        name: '🎯 TARGET SHOOT',
        instructions: 'CLICK TARGETS TO SCORE! SMALLER = MORE POINTS!',
        icon: '🎯',
        minPlayers: 2,
        maxPlayers: 8
    },

    // ===== CLASSIC GAMES =====
    'rock-paper-scissors': {
        component: React.lazy(() => import('./RockPaperScissors/RockPaperScissors')),
        name: '✊ ROCK PAPER SCISSORS',
        instructions: 'CHOOSE WISELY! BEST OF 5 ROUNDS!',
        icon: '✊',
        minPlayers: 2,
        maxPlayers: 2
    },

    // ===== SKILL GAMES =====
    'balance-beam': {
        component: React.lazy(() => import('./BalanceBeam/BalanceBeam')),
        name: '⚖️ BALANCE BEAM',
        instructions: 'TILT TO KEEP YOUR BALL BALANCED! LAST ONE STANDING WINS!',
        icon: '⚖️',
        minPlayers: 2,
        maxPlayers: 4
    }
}

/**
 * Get a random minigame ID from the registry
 */
export const getRandomMinigameId = (): string | null => {
    const keys = Object.keys(MINIGAME_REGISTRY)
    if (keys.length === 0) return null
    return keys[Math.floor(Math.random() * keys.length)]
}

/**
 * Get all minigame entries as an array (for selection UI)
 */
export const getAllMinigames = (): { id: string; entry: MinigameEntry }[] => {
    return Object.entries(MINIGAME_REGISTRY).map(([id, entry]) => ({ id, entry }))
}

/**
 * Get minigames filtered by player count
 */
export const getMinigamesForPlayerCount = (playerCount: number): { id: string; entry: MinigameEntry }[] => {
    return getAllMinigames().filter(
        ({ entry }) => playerCount >= entry.minPlayers && playerCount <= entry.maxPlayers
    )
}

/**
 * Get a random minigame ID suitable for the given player count
 */
export const getRandomMinigameForPlayers = (playerCount: number): string | null => {
    const suitable = getMinigamesForPlayerCount(playerCount)
    if (suitable.length === 0) return null
    return suitable[Math.floor(Math.random() * suitable.length)].id
}
