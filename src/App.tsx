import { Suspense, useEffect, useState } from 'react'
import { useGame } from './context/GameContext'
import { CRTOverlay } from './components/layout/CRTOverlay'
import { Lobby } from './features/lobby/Lobby'
import { MinigameSelector } from './features/lobby/MinigameSelector'
import { MINIGAME_REGISTRY, getRandomMinigameId } from './features/minigames/MinigameRegistry'
import { motion, AnimatePresence } from 'framer-motion'

interface GameResult {
  winnerId?: string
  winnerName?: string
  isDraw?: boolean
  message?: string
}

function App() {
  const { room, minigame, players, setRoomStatus, currentPlayer, startGame } = useGame()
  const [lastResult, setLastResult] = useState<GameResult | null>(null)
  const [autoNextCountdown, setAutoNextCountdown] = useState(5)
  const [gameSessionId, setGameSessionId] = useState(0)
  const [showGameSelector, setShowGameSelector] = useState(false)

  const handleGameEnd = async (results: { winnerId?: string }) => {
    console.log('Game Over', results)

    const winner = results.winnerId ? players.find(p => p.id === results.winnerId) : null

    setLastResult({
      winnerId: results.winnerId,
      winnerName: winner?.username || 'Unknown',
      isDraw: !results.winnerId,
      message: results.winnerId ? `${winner?.username || 'Unknown'} WINS!` : 'DRAW!'
    })

    // Award points to winner (only host does this to prevent duplicates)
    if (currentPlayer?.is_host && results.winnerId) {
      const winnerPlayer = players.find(p => p.id === results.winnerId)
      if (winnerPlayer) {
        const { supabase } = await import('./lib/supabaseClient')
        await supabase.from('players').update({
          score: winnerPlayer.score + 1
        }).eq('id', winnerPlayer.id)
        console.log('[SCORE] Awarded 1 point to:', winnerPlayer.username)

        // Wait a moment for realtime sync to propagate to all clients
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Move to RESULTS state (after score update has propagated)
    if (currentPlayer?.is_host) {
      setRoomStatus('SCOREBOARD')
    }
  }

  // Increment session ID when entering PLAYING state (forces minigame component remount)
  useEffect(() => {
    if (room?.status === 'PLAYING') {
      setGameSessionId(prev => prev + 1)
    }
  }, [room?.status])

  // Auto-countdown to next game
  useEffect(() => {
    if (room?.status !== 'SCOREBOARD') {
      setAutoNextCountdown(5)
      return
    }

    const interval = setInterval(() => {
      setAutoNextCountdown(prev => {
        if (prev <= 1 && currentPlayer?.is_host) {
          // Auto start next game
          handleNextGame()
          return 5
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [room?.status, currentPlayer?.is_host])

  const handleNextGame = async () => {
    if (!currentPlayer?.is_host) return
    const nextGameId = getRandomMinigameId()
    if (nextGameId) {
      setRoomStatus('INSTRUCTIONS', nextGameId)
    }
  }

  const handleReturnToLobby = async () => {
    if (!currentPlayer?.is_host) return
    setRoomStatus('LOBBY', undefined)
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
                  <div className="flex flex-col gap-4 w-full max-w-xs">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => startGame()}
                      disabled={players.length < 2}
                      className={`
                        w-full py-4 text-xl font-pixel rounded-lg transition-all
                        ${players.length >= 2
                          ? 'bg-atari-green text-black hover:bg-atari-cyan cursor-pointer'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }
                      `}
                      style={players.length >= 2 ? { boxShadow: '0 0 20px #39ff14' } : {}}
                    >
                      {players.length >= 2 ? 'START RANDOM GAME' : 'NEED 2+ PLAYERS'}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowGameSelector(true)}
                      className="w-full py-3 text-lg font-pixel bg-gray-800 text-atari-cyan border border-atari-cyan rounded-lg hover:bg-gray-700 transition-all"
                    >
                      CHOOSE MINIGAME
                    </motion.button>
                  </div>
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
              <>
                {/* Back to Lobby Button (Host only) */}
                {currentPlayer?.is_host && (
                  <div className="absolute top-2 left-2 z-50">
                    <button
                      onClick={handleReturnToLobby}
                      className="px-3 py-1 bg-black/50 text-white/50 text-xs hover:text-white hover:bg-red-900 border border-white/20 rounded backdrop-blur-sm transition-colors"
                    >
                      🏠 LOBBY
                    </button>
                  </div>
                )}

                <Suspense fallback={<LoadingScreen />}>
                  <ActiveGame
                    key={`${minigame}-${gameSessionId}`}
                    players={players}
                    difficulty="medium"
                    onGameEnd={handleGameEnd}
                  />
                </Suspense>
              </>
            )}

            {/* ===== RESULTS/SCOREBOARD STATE ===== */}
            {room.status === 'SCOREBOARD' && (
              <ResultsScreen
                players={players}
                lastResult={lastResult}
                countdown={autoNextCountdown}
                isHost={currentPlayer?.is_host ?? false}
                onNextGame={handleNextGame}
                onReturnToLobby={handleReturnToLobby}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minigame Selector Overlay */}
      <AnimatePresence>
        {showGameSelector && (
          <MinigameSelector
            playerCount={players.length}
            onCancel={() => setShowGameSelector(false)}
            onSelect={(gameId) => {
              setShowGameSelector(false)
              startGame(gameId)
            }}
          />
        )}
      </AnimatePresence>
    </div >
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
  const [countdown, setCountdown] = useState(3)

  // Countdown for all players
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          if (isHost) {
            onStart()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isHost, onStart])

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        className="text-center"
      >
        <div className="text-6xl mb-4">
          {MINIGAME_REGISTRY[minigame]?.icon || '🎮'}
        </div>
        <h1 className="text-4xl md:text-7xl font-pixel text-atari-yellow mb-6"
          style={{ textShadow: '0 0 30px #ffff00' }}>
          {MINIGAME_REGISTRY[minigame]?.name || 'MINIGAME'}
        </h1>
        <p className="text-xl md:text-3xl text-white mb-8 max-w-xl">
          {MINIGAME_REGISTRY[minigame]?.instructions}
        </p>

        <motion.div
          key={countdown}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-7xl font-pixel text-atari-cyan"
          style={{ textShadow: '0 0 20px #00ffff' }}
        >
          {countdown > 0 ? countdown : 'GO!'}
        </motion.div>
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

// ===== RESULTS SCREEN =====
function ResultsScreen({
  players,
  lastResult,
  countdown,
  isHost,
  onNextGame,
  onReturnToLobby
}: {
  players: any[]
  lastResult: GameResult | null
  countdown: number
  isHost: boolean
  onNextGame: () => void
  onReturnToLobby: () => void
}) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      {/* Winner announcement */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="text-center mb-8"
      >
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-4xl md:text-6xl font-pixel text-atari-yellow mb-2"
          style={{ textShadow: '0 0 20px #FFD700' }}>
          {lastResult?.message || 'GAME OVER!'}
        </h1>
      </motion.div>

      {/* Scoreboard */}
      <div className="bg-black/50 border-2 border-atari-green rounded-lg p-6 mb-8 min-w-[300px]">
        <h2 className="text-xl font-pixel text-atari-green mb-4 text-center">SCOREBOARD</h2>
        <ul className="space-y-3">
          {sortedPlayers.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.15 }}
              className={`flex justify-between items-center text-xl ${i === 0 ? 'text-atari-yellow' : 'text-white'
                }`}
            >
              <span className="flex items-center gap-2">
                <span>{i === 0 ? '👑' : `${i + 1}.`}</span>
                <span>{p.username}</span>
              </span>
              <span className="font-pixel text-atari-cyan">{p.score} pts</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Auto next game countdown */}
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1 }}
        className="text-2xl text-atari-cyan mb-4"
      >
        Next game in {countdown}...
      </motion.div>

      {/* Action buttons (Host only) */}
      {isHost && (
        <div className="flex gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNextGame}
            className="px-6 py-3 text-lg font-pixel bg-atari-green text-black rounded-lg"
            style={{ boxShadow: '0 0 15px #39ff14' }}
          >
            ▶ NEXT GAME
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onReturnToLobby}
            className="px-6 py-3 text-lg font-pixel bg-gray-700 text-white rounded-lg border border-gray-500"
          >
            ← LOBBY
          </motion.button>
        </div>
      )}

      {!isHost && (
        <p className="text-white/50 text-sm">
          Waiting for host...
        </p>
      )}
    </div>
  )
}

export default App
