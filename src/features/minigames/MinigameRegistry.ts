import React from 'react'
import type { MinigameProps } from '../../types'
// We will import HighNoon later when it's created, for now use a placeholder or dynamic import if possible
// To avoid circular deps or missing files, we'll define the registry structure first.

export type MinigameComponent = React.ComponentType<MinigameProps>

export const MINIGAME_REGISTRY: Record<string, { component: React.LazyExoticComponent<MinigameComponent> | MinigameComponent, name: string, instructions: string }> = {
    'high-noon': {
        component: React.lazy(() => import('./HighNoon/HighNoon')),
        name: 'High Noon',
        instructions: 'FASTEST FINGER WINS!'
    }
}

export const getRandomMinigameId = () => {
    const keys = Object.keys(MINIGAME_REGISTRY)
    if (keys.length === 0) return null
    return keys[Math.floor(Math.random() * keys.length)]
}
