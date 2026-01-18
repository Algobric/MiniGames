/**
 * Sound effects for minigames using Web Audio API
 * All sounds are synthesized - no external audio files needed
 */

let audioContext: AudioContext | null = null
let isUnlocked = false

/**
 * Initialize and unlock audio context (must be called after user interaction)
 */
export function unlockAudio(): void {
    if (isUnlocked) return

    try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

        // Play a silent sound to unlock on iOS
        const buffer = audioContext.createBuffer(1, 1, 22050)
        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(audioContext.destination)
        source.start(0)

        isUnlocked = true
        console.log('[AUDIO] Unlocked')
    } catch (e) {
        console.warn('[AUDIO] Failed to unlock:', e)
    }
}

function getContext(): AudioContext | null {
    if (!audioContext) {
        unlockAudio()
    }
    return audioContext
}

/**
 * Play a gunshot sound effect
 */
export function playGunshot(): void {
    const ctx = getContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Noise burst for the crack
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02))
    }

    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = noiseBuffer

    // Low frequency thump
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1)

    // Gains
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.8, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)

    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0.6, now)
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)

    // Connect
    noiseSource.connect(noiseGain)
    noiseGain.connect(ctx.destination)

    osc.connect(oscGain)
    oscGain.connect(ctx.destination)

    // Play
    noiseSource.start(now)
    noiseSource.stop(now + 0.1)
    osc.start(now)
    osc.stop(now + 0.15)
}

/**
 * Play the "DRAW!" signal sound
 */
export function playDrawSignal(): void {
    const ctx = getContext()
    if (!ctx) return

    const now = ctx.currentTime

    // High-pitched beep
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.setValueAtTime(1100, now + 0.05)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.4, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.15)
}

/**
 * Play a winner fanfare
 */
export function playWinFanfare(): void {
    const ctx = getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + i * 0.1)

        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.3, now + i * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + i * 0.1)
        osc.stop(now + i * 0.1 + 0.3)
    })
}

/**
 * Play a lose/fail sound
 */
export function playFail(): void {
    const ctx = getContext()
    if (!ctx) return

    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.3)
}

/**
 * Play a button tap sound
 */
export function playTap(): void {
    const ctx = getContext()
    if (!ctx) return

    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, now)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.05)
}

/**
 * Play countdown beep
 */
export function playCountdownBeep(final: boolean = false): void {
    const ctx = getContext()
    if (!ctx) return

    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(final ? 880 : 440, now)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.15)
}
