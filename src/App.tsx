import { Suspense, useEffect } from 'react'
import { useGame } from './context/GameContext'
import { CRTOverlay } from './components/layout/CRTOverlay'
import { Lobby } from './features/lobby/Lobby'
import { MINIGAME_REGISTRY } from './features/minigames/MinigameRegistry'
import { motion, AnimatePresence } from 'framer-motion'

function App() {
  const { room, minigame, players, setRoomStatus, currentPlayer, startGame } = useGame()

  const handleGameEnd = async (results: { winnerId?: string }) => {
    console.log('Game Over', results)
    // Return to lobby after showing results
    if (currentPlayer?.is_host) {
      setTimeout(() => {
        setRoomStatus('LOBBY', undefined)
      }, 4000)
    }
  }

  // Render Minigame if active
  const ActiveGame = minigame ? MINIGAME_REGISTRY[minigame]?.component : null

  return (
    <div className="relative w-screen h-screen bg-atari-black text-atari-green font-mono overflow-hidden">
      <CRTOverlay />

      <AnimatePresence mode="wait">
        {!room ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <Lobby />
          </motion.div>
        ) : (
          <motion.div
            key="room"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full h-full"
          >
            {/* ===== LOBBY STATE ===== */}
            {room.status === 'LOBBY' && (
              <div className="flex flex-col items-center justify-center h-full p-4">
                {/* Room Code Display */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center">
                  <p className="text-sm text-atari-green/50 mb-1">ROOM CODE</p>
                  <div className="text-4xl md:text-6xl font-pixel text-atari-cyan tracking-widest"
                    style={{ textShadow: '0 0 20px #00ffff' }}>
                    {room.code}
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-5xl font-pixel text-atari-green mb-8 text-center"
                  style={{ textShadow: '0 0 15px #39ff14' }}>
                  WAITING FOR PLAYERS...
                </h1>

                {/* Player List */}
                <div className="bg-black/50 border-2 border-atari-green rounded-lg p-4 mb-8 min-w-[280px]">
                  <p className="text-sm text-atari-green/70 mb-3 text-center">
                    CONNECTED ({players.length})
                  </p>
                  <ul className="space-y-2">
                    {players.map((p, i) => (
                      <motion.li
                        key={p.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center justify-between text-lg"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-2xl">{['🤠', '🎮', '👾', '🎯', '⚡', '🔥', '💀', '🚀'][p.avatar_id % 8]}</span>
                          <span className={p.is_host ? 'text-atari-yellow' : 'text-white'}>
                            {p.username}
                          </span>
                        </span>
                        <span className="text-xs text-atari-green/50">
                          {p.is_host ? 'HOST' : 'GUEST'}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Start Button (Host Only) */}
                {currentPlayer?.is_host ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => startGame()}
                    disabled={players.length < 2}
                    className={`
                      px-8 py-4 text-xl font-pixel rounded-lg transition-all
                      ${players.length >= 2
                        ? 'bg-atari-green text-black hover:bg-atari-cyan cursor-pointer'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }
                    `}
                    style={players.length >= 2 ? { boxShadow: '0 0 20px #39ff14' } : {}}
                  >
                    {players.length >= 2 ? 'START GAME' : 'NEED 2+ PLAYERS'}
                  </motion.button>
                ) : (
                  <div className="text-center">
                    <p className="text-atari-yellow animate-pulse text-lg">
                      WAITING FOR HOST TO START...
                    </p>
                  </div>
                )}

                {/* Player count hint */}
                {currentPlayer?.is_host && players.length < 2 && (
                  <p className="mt-4 text-sm text-atari-pink animate-pulse">
                    Share the room code with friends!
                  </p>
                )}
              </div>
            )}

            {/* ===== INSTRUCTIONS STATE ===== */}
            {room.status === 'INSTRUCTIONS' && minigame && (
              <InstructionsScreen
                minigame={minigame}
                isHost={currentPlayer?.is_host ?? false}
                onStart={() => setRoomStatus('PLAYING')}
              />
            )}

            {/* ===== PLAYING STATE ===== */}
            {room.status === 'PLAYING' && ActiveGame && (
              <Suspense fallback={<LoadingScreen />}>
                <ActiveGame
                  players={players}
                  difficulty="medium"
                  onGameEnd={handleGameEnd}
                />
              </Suspense>
            )}

            {/* ===== SCOREBOARD STATE ===== */}
            {room.status === 'SCOREBOARD' && (
              <ScoreboardScreen players={players} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ===== INSTRUCTIONS SCREEN =====
function InstructionsScreen({
  minigame,
  isHost,
  onStart
}: {
  minigame: string
  isHost: boolean
  onStart: () => void
}) {
  // Auto-start countdown for host
  useEffect(() => {
    if (!isHost) return
    const timer = setTimeout(() => {
      onStart()
    }, 3000) // 3 second countdown
    return () => clearTimeout(timer)
  }, [isHost, onStart])

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        className="text-center"
      >
        <h1 className="text-5xl md:text-8xl font-pixel text-atari-yellow mb-8"
          style={{ textShadow: '0 0 30px #ffff00' }}>
          {MINIGAME_REGISTRY[minigame]?.name || 'MINIGAME'}
        </h1>
        <p className="text-2xl md:text-4xl text-white mb-8">
          {MINIGAME_REGISTRY[minigame]?.instructions}
        </p>
        <motion.p
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className="text-xl text-atari-cyan"
        >
          GET READY...
        </motion.p>
      </motion.div>
    </div>
  )
}

// ===== LOADING SCREEN =====
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="text-6xl"
      >
        ⏳
      </motion.div>
    </div>
  )
}

// ===== SCOREBOARD SCREEN =====
function ScoreboardScreen({ players }: { players: any[] }) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <h1 className="text-4xl font-pixel text-atari-yellow mb-8">SCOREBOARD</h1>
      <ul className="space-y-4">
        {sortedPlayers.map((p, i) => (
          <motion.li
            key={p.id}
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.2 }}
            className={`text-2xl ${i === 0 ? 'text-atari-yellow' : 'text-white'}`}
          >
            {i + 1}. {p.username} - {p.score} pts
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

export default App
