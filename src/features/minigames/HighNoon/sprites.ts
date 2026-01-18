/**
 * Pixel-art cowboy sprites as CSS/SVG
 * Using CSS-based pixel art for simplicity and performance
 */

// Atari-style color palette
export const COWBOY_COLORS = {
    hat: '#8B4513',      // Saddle brown
    skin: '#FFDAB9',     // Peach
    shirt: '#DC143C',    // Crimson
    pants: '#191970',    // Midnight blue
    boots: '#2F1B0C',    // Dark brown
    gun: '#404040',      // Gray
    outline: '#000000',  // Black
    muzzleFlash: '#FFD700', // Gold
    smoke: '#808080',    // Gray
}

// Player 1 cowboy (facing right)
export const COWBOY_P1_IDLE = `
  ████
 █    █
█  ██  █
█ ████ █
  ████
   ██
  ████
 ██  ██
 █    █
██    ██
`

// Player 2 cowboy (facing left) 
export const COWBOY_P2_IDLE = `
  ████
 █    █
█  ██  █
█ ████ █
  ████
   ██
  ████
 ██  ██
 █    █
██    ██
`

/**
 * Generate a cowboy SVG sprite
 */
export function createCowboySVG(
    facing: 'left' | 'right',
    state: 'idle' | 'draw' | 'shoot' | 'hit',
    color: string = COWBOY_COLORS.shirt
): string {
    const scale = 4
    const width = 16 * scale
    const height = 24 * scale

    const armOffset = state === 'draw' ? 2 : state === 'shoot' ? 4 : 0
    const transform = facing === 'left' ? `scale(-1, 1) translate(-${width}, 0)` : ''

    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 16 24">
        <g transform="${transform}" style="image-rendering: pixelated;">
            <!-- Hat -->
            <rect x="4" y="0" width="8" height="2" fill="${COWBOY_COLORS.hat}"/>
            <rect x="2" y="2" width="12" height="3" fill="${COWBOY_COLORS.hat}"/>
            
            <!-- Head -->
            <rect x="5" y="5" width="6" height="5" fill="${COWBOY_COLORS.skin}"/>
            <rect x="6" y="6" width="1" height="1" fill="#000"/>
            <rect x="9" y="6" width="1" height="1" fill="#000"/>
            
            <!-- Body -->
            <rect x="4" y="10" width="8" height="6" fill="${color}"/>
            
            <!-- Arms -->
            <rect x="${2 - armOffset}" y="11" width="2" height="4" fill="${color}"/>
            <rect x="${12 + armOffset}" y="11" width="2" height="4" fill="${color}"/>
            
            <!-- Gun (if drawing or shooting) -->
            ${state === 'draw' || state === 'shoot' ? `
                <rect x="${facing === 'right' ? 14 : 0}" y="12" width="4" height="2" fill="${COWBOY_COLORS.gun}"/>
                ${state === 'shoot' ? `
                    <circle cx="${facing === 'right' ? 19 : -3}" cy="13" r="3" fill="${COWBOY_COLORS.muzzleFlash}" opacity="0.9"/>
                ` : ''}
            ` : ''}
            
            <!-- Pants -->
            <rect x="5" y="16" width="6" height="4" fill="${COWBOY_COLORS.pants}"/>
            
            <!-- Legs -->
            <rect x="5" y="20" width="2" height="4" fill="${COWBOY_COLORS.pants}"/>
            <rect x="9" y="20" width="2" height="4" fill="${COWBOY_COLORS.pants}"/>
            
            <!-- Boots -->
            <rect x="4" y="22" width="3" height="2" fill="${COWBOY_COLORS.boots}"/>
            <rect x="9" y="22" width="3" height="2" fill="${COWBOY_COLORS.boots}"/>
            
            <!-- Hit state (X eyes, fallen) -->
            ${state === 'hit' ? `
                <rect x="6" y="6" width="1" height="1" fill="#F00"/>
                <rect x="7" y="7" width="1" height="1" fill="#F00"/>
                <rect x="8" y="6" width="1" height="1" fill="#F00"/>
                <rect x="9" y="7" width="1" height="1" fill="#F00"/>
            ` : ''}
        </g>
    </svg>
    `.trim()
}

/**
 * Create a muzzle flash effect
 */
export function createMuzzleFlashSVG(): string {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
        <circle cx="16" cy="16" r="10" fill="#FFD700" opacity="0.7"/>
        <circle cx="16" cy="16" r="14" fill="#FFA500" opacity="0.4"/>
        <rect x="18" y="14" width="12" height="4" fill="#FFD700"/>
        <polygon points="30,16 38,12 38,20" fill="#FFA500" opacity="0.5"/>
    </svg>
    `.trim()
}

/**
 * React component for displaying a cowboy
 */
export interface CowboyProps {
    facing: 'left' | 'right'
    state: 'idle' | 'draw' | 'shoot' | 'hit'
    color?: string
    className?: string
}

/**
 * Convert SVG string to data URL for use in img src
 */
export function svgToDataUrl(svg: string): string {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Get cowboy sprite as data URL
 */
export function getCowboySprite(
    facing: 'left' | 'right',
    state: 'idle' | 'draw' | 'shoot' | 'hit',
    color?: string
): string {
    return svgToDataUrl(createCowboySVG(facing, state, color))
}
