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
    'high-noon': {
        component: React.lazy(() => import('./HighNoon/HighNoon')),
        name: '🤠 HIGH NOON',
        instructions: 'WAIT FOR "DRAW!" THEN TAP FIRST TO WIN!',
        icon: '🤠',
        minPlayers: 2,
        maxPlayers: 8
    },
    'button-mash': {
        component: React.lazy(() => import('./ButtonMash/ButtonMash')),
        name: '👆 BUTTON MASH',
        instructions: 'TAP AS FAST AS YOU CAN FOR 5 SECONDS!',
        icon: '👆',
        minPlayers: 2,
        maxPlayers: 8
    },
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
