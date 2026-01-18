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
    // ===== ⚡ REACTION & SPEED GAMES =====
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
    'button-mash': {
        component: React.lazy(() => import('./ButtonMash/ButtonMash')),
        name: '👆 BUTTON MASH',
        instructions: 'TAP AS FAST AS YOU CAN FOR 5 SECONDS!',
        icon: '👆',
        minPlayers: 2,
        maxPlayers: 8
    },
    'tug-of-war': {
        component: React.lazy(() => import('./TugOfWar/TugOfWar')),
        name: '🪢 TUG OF WAR',
        instructions: 'SPAM THE BUTTON TO PULL THE ROPE!',
        icon: '🪢',
        minPlayers: 2,
        maxPlayers: 2
    },
    'balloon-pop': {
        component: React.lazy(() => import('./BalloonPop/BalloonPop')),
        name: '🎈 BALLOON POP',
        instructions: 'INFLATE YOUR BALLOON - BUT DON\'T POP IT!',
        icon: '🎈',
        minPlayers: 2,
        maxPlayers: 8
    },
    'timber': {
        component: React.lazy(() => import('./Timber/Timber')),
        name: '🪓 TIMBER',
        instructions: 'CHOP THE TREE - DODGE THE BRANCHES!',
        icon: '🪓',
        minPlayers: 2,
        maxPlayers: 8
    },

    // ===== 🎯 PRECISION & TIMING GAMES =====
    'stop-watch': {
        component: React.lazy(() => import('./StopWatch/StopWatch')),
        name: '⏱️ STOP WATCH',
        instructions: 'STOP THE HIDDEN TIMER CLOSEST TO 10.00 SECONDS!',
        icon: '⏱️',
        minPlayers: 2,
        maxPlayers: 8
    },
    'traffic-light': {
        component: React.lazy(() => import('./TrafficLight/TrafficLight')),
        name: '🚦 TRAFFIC LIGHT',
        instructions: 'MOVE ON GREEN - STOP ON RED!',
        icon: '🚦',
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
    'one-click-golf': {
        component: React.lazy(() => import('./OneClickGolf/OneClickGolf')),
        name: '⛳ ONE CLICK GOLF',
        instructions: 'CLICK FOR DIRECTION - CLICK AGAIN FOR POWER!',
        icon: '⛳',
        minPlayers: 2,
        maxPlayers: 4
    },
    'draw-circle': {
        component: React.lazy(() => import('./DrawCircle/DrawCircle')),
        name: '⭕ DRAW CIRCLE',
        instructions: 'DRAW THE MOST PERFECT CIRCLE!',
        icon: '⭕',
        minPlayers: 2,
        maxPlayers: 8
    },

    // ===== 🧠 MEMORY & PUZZLE GAMES =====
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
        instructions: 'REPEAT THE COLOR SEQUENCE - LAST ONE STANDING!',
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
    'shell-game': {
        component: React.lazy(() => import('./ShellGame/ShellGame')),
        name: '🎩 SHELL GAME',
        instructions: 'FIND THE BALL UNDER THE CUP!',
        icon: '🎩',
        minPlayers: 2,
        maxPlayers: 8
    },
    'number-order': {
        component: React.lazy(() => import('./NumberOrder/NumberOrder')),
        name: '🔢 NUMBER ORDER',
        instructions: 'CLICK NUMBERS 1-10 IN ORDER!',
        icon: '🔢',
        minPlayers: 2,
        maxPlayers: 8
    },
    'inverse-arrows': {
        component: React.lazy(() => import('./InverseArrows/InverseArrows')),
        name: '🔄 INVERSE ARROWS',
        instructions: 'PRESS THE OPPOSITE DIRECTION!',
        icon: '🔄',
        minPlayers: 2,
        maxPlayers: 8
    },

    // ===== ⌨️ PC GAMER SKILLS =====
    'type-race': {
        component: React.lazy(() => import('./TypeRace/TypeRace')),
        name: '⌨️ TYPE RACE',
        instructions: 'TYPE THE PHRASE AS FAST AS POSSIBLE!',
        icon: '⌨️',
        minPlayers: 2,
        maxPlayers: 8
    },
    'paint-floor': {
        component: React.lazy(() => import('./PaintFloor/PaintFloor')),
        name: '🎨 PAINT FLOOR',
        instructions: 'PAINT MORE CELLS THAN YOUR OPPONENT!',
        icon: '🎨',
        minPlayers: 2,
        maxPlayers: 4
    },

    // ===== 🎮 ACTION & ARCADE GAMES =====
    'tank-battle': {
        component: React.lazy(() => import('./TankBattle/TankBattle')),
        name: '🎖️ TANK BATTLE',
        instructions: 'MOVE AND SHOOT! HIT YOUR OPPONENT TO SCORE!',
        icon: '🎖️',
        minPlayers: 2,
        maxPlayers: 4
    },
    'meteor-rain': {
        component: React.lazy(() => import('./MeteorRain/MeteorRain')),
        name: '☄️ METEOR RAIN',
        instructions: 'DODGE THE FALLING METEORS! LAST ONE STANDING!',
        icon: '☄️',
        minPlayers: 2,
        maxPlayers: 8
    },
    'slime-pong': {
        component: React.lazy(() => import('./SlimePong/SlimePong')),
        name: '🏓 SLIME PONG',
        instructions: 'CLASSIC PONG - FIRST TO 5 WINS!',
        icon: '🏓',
        minPlayers: 2,
        maxPlayers: 2
    },
    'sumo-slap': {
        component: React.lazy(() => import('./SumoSlap/SumoSlap')),
        name: '🤼 SUMO SLAP',
        instructions: 'PUSH YOUR OPPONENT OUT OF THE RING!',
        icon: '🤼',
        minPlayers: 2,
        maxPlayers: 2
    },

    // ===== 🎲 CLASSIC & STRATEGY =====
    'rock-paper-scissors': {
        component: React.lazy(() => import('./RockPaperScissors/RockPaperScissors')),
        name: '✊ ROCK PAPER SCISSORS',
        instructions: 'CHOOSE WISELY! BEST OF 5 ROUNDS!',
        icon: '✊',
        minPlayers: 2,
        maxPlayers: 2
    },
    'balance-beam': {
        component: React.lazy(() => import('./BalanceBeam/BalanceBeam')),
        name: '⚖️ BALANCE BEAM',
        instructions: 'TILT TO KEEP YOUR BALL BALANCED!',
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

/**
 * Get minigames by category
 */
export const getMinigamesByCategory = (): Record<string, { id: string; entry: MinigameEntry }[]> => {
    const categories: Record<string, { id: string; entry: MinigameEntry }[]> = {
        'Reaction & Speed': [],
        'Precision & Timing': [],
        'Memory & Puzzle': [],
        'PC Gamer Skills': [],
        'Action & Arcade': [],
        'Classic & Strategy': []
    }

    const categoryMap: Record<string, string> = {
        'high-noon': 'Reaction & Speed',
        'reaction-race': 'Reaction & Speed',
        'button-mash': 'Reaction & Speed',
        'tug-of-war': 'Reaction & Speed',
        'balloon-pop': 'Reaction & Speed',
        'timber': 'Reaction & Speed',
        'stop-watch': 'Precision & Timing',
        'traffic-light': 'Precision & Timing',
        'target-shoot': 'Precision & Timing',
        'one-click-golf': 'Precision & Timing',
        'draw-circle': 'Precision & Timing',
        'color-match': 'Memory & Puzzle',
        'memory-flash': 'Memory & Puzzle',
        'number-crunch': 'Memory & Puzzle',
        'shell-game': 'Memory & Puzzle',
        'number-order': 'Memory & Puzzle',
        'inverse-arrows': 'Memory & Puzzle',
        'type-race': 'PC Gamer Skills',
        'paint-floor': 'PC Gamer Skills',
        'tank-battle': 'Action & Arcade',
        'meteor-rain': 'Action & Arcade',
        'slime-pong': 'Action & Arcade',
        'sumo-slap': 'Action & Arcade',
        'rock-paper-scissors': 'Classic & Strategy',
        'balance-beam': 'Classic & Strategy'
    }

    for (const [id, entry] of Object.entries(MINIGAME_REGISTRY)) {
        const category = categoryMap[id] || 'Action & Arcade'
        categories[category].push({ id, entry })
    }

    return categories
}
