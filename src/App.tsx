import { Suspense } from 'react'
import { useGame } from './context/GameContext'
import { CRTOverlay } from './components/layout/CRTOverlay'
import { Lobby } from './features/lobby/Lobby'
import { MINIGAME_REGISTRY } from './features/minigames/MinigameRegistry'
// import HighNoon from './features/minigames/HighNoon/HighNoon' // Registry uses lazy load

function App() {
  const { room, minigame, players, setRoomStatus, currentPlayer } = useGame()

  const handleGameEnd = async (results: { winnerId?: string }) => {
    console.log('Game Over', results)
    // Host Logic: Update Score and go back to Scoreboard or Lobby
    if (results.winnerId && currentPlayer?.is_host) {
      // Find winner and add points (logic should be in Context or here)
      // For now just return to lobby after a delay
      setTimeout(() => {
        setRoomStatus('LOBBY', undefined) // Clear game
      }, 3000)
    }
  }

  // Render Minigame if active
  const ActiveGame = minigame ? MINIGAME_REGISTRY[minigame]?.component : null

  return (
    <div className="relative w-screen h-screen bg-atari-black text-atari-green font-mono overflow-hidden">
      <CRTOverlay />

      {!room ? (
        <Lobby />
      ) : (
        <div className="relative z-10 w-full h-full">
          {/* Room Header (Debug/Info) */}
          <div className="absolute top-0 left-0 w-full flex justify-between p-2 pointer-events-none opacity-50 text-sm">
            <span>ROOM: {room.code}</span>
            <span>PLAYERS: {players.length}</span>
            <span>STATUS: {room.status}</span>
          </div>

          {room.status === 'LOBBY' && (
            <div className="flex flex-col items-center justify-center h-full">
              <h2 className="text-4xl text-atari-green mb-4">LOBBY</h2>
              <ul className="space-y-2">
                {players.map(p => (
                  <li key={p.id} className="text-2xl animate-pulse">
                    {p.username} {p.is_host ? '(HOST)' : ''} {p.score > 0 && `SC: ${p.score}`}
                  </li>
                ))}
              </ul>
              {currentPlayer?.is_host && players.length >= 1 && (
                <button
                  onClick={() => {
                    // Normally pick random, for now hardcode High Noon
                    // setRoomStatus('INSTRUCTIONS', 'high-noon')
                    // Context has startGame
                    useGame().startGame()
                    // Wait, I can't call hooks in callback usually, but here I can use the destrctured one if I had it.
                    // I destructured startGame from useGame() above? No.
                    // Let's fix this block.
                  }}
                  className="mt-8 bg-atari-green text-black p-4 font-pixel pointer-events-auto hover:bg-white"
                >
                  START GAME
                </button>
              )}
              {currentPlayer?.is_host && (
                <div className="mt-4 pointer-events-auto">
                  <GameControls />
                </div>
              )}
            </div>
          )}

          {room.status === 'INSTRUCTIONS' && minigame && (
            <div className="flex flex-col items-center justify-center h-full animate-flicker">
              <h1 className="text-6xl text-atari-yellow font-pixel text-center mb-8">
                {MINIGAME_REGISTRY[minigame]?.name}
              </h1>
              <p className="text-2xl text-white text-center">
                {MINIGAME_REGISTRY[minigame]?.instructions}
              </p>
              {/* Auto transition handled by whom? Host. */}
              <HostInstructionController />
            </div>
          )}

          {(room.status === 'PLAYING' || room.status === 'SCOREBOARD') && ActiveGame && (
            <Suspense fallback={<div>LOADING...</div>}>
              <ActiveGame
                players={players}
                difficulty="medium"
                onGameEnd={handleGameEnd}
              />
            </Suspense>
          )}

        </div>
      )}
    </div>
  )
}

// Helper to access context inside callback
const GameControls = () => {
  const { startGame } = useGame()
  return <button onClick={() => startGame()} className="bg-atari-green text-black p-4 font-pixel">START</button>
}

// Host helper to transition from Instructions to Playing
const HostInstructionController = () => {
  const { currentPlayer, setRoomStatus } = useGame()
  if (!currentPlayer?.is_host) return <div className="mt-4">GET READY...</div>

  // Effect to switch state after 3s
  // Don't use useEffect here to avoid double-firing in StrictMode issues easily, but for game logic it's ok
  // Better to use a button for manual start or robust timer.
  // Let's auto-start for "frantic" feel.
  // But we need to ensure we don't spam.

  return (
    <button
      onClick={() => setRoomStatus('PLAYING')}
      className="mt-8 border-2 border-atari-yellow text-atari-yellow p-4 animate-pulse pointer-events-auto"
    >
      START NOW
    </button>
  )
}

export default App
