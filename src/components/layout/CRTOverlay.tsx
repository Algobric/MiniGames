export const CRTOverlay = () => {
    return (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden h-full w-full">
            {/* Scanlines */}
            <div className="absolute inset-0 z-50 bg-repeat crt-scanline opacity-10 pointer-events-none animate-scanline"></div>

            {/* Vignette */}
            <div className="absolute inset-0 z-50 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)] pointer-events-none"></div>

            {/* Phosphor Glow/Bleed (Subtle blur) */}
            <div className="absolute inset-0 z-40 backdrop-blur-[0.5px] pointer-events-none"></div>

            {/* Screen Curvature (Optional, keep subtle) */}
            <div className="absolute inset-0 z-50 shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] pointer-events-none"></div>
        </div>
    )
}
