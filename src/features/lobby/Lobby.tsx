import { useState } from 'react'
import { useGame } from '../../context/GameContext'

export const Lobby = () => {
    const { createRoom, joinRoom, error } = useGame()
    const [username, setUsername] = useState('')
    const [roomCode, setRoomCode] = useState('')
    const [mode, setMode] = useState<'menu' | 'join' | 'host'>('menu')

    const handleHost = async () => {
        if (!username) return alert('ENTER NAME')
        await createRoom(username)
    }

    const handleJoin = async () => {
        if (!username || !roomCode) return alert('ENTER DETAILS')
        await joinRoom(roomCode.toUpperCase(), username)
    }

    return (
        <div className="flex flex-col items-center justify-center h-full space-y-8 p-4 w-full max-w-md mx-auto z-10 relative">
            <h1 className="text-6xl font-pixel text-atari-green text-shadow-glow mb-8 animate-flicker">
                RETRO RUSH
            </h1>

            {mode === 'menu' && (
                <div className="flex flex-col space-y-4 w-full">
                    <input
                        type="text"
                        placeholder="CODENAME"
                        className="bg-atari-black border-2 border-atari-green text-atari-green p-4 font-mono text-2xl outline-none focus:shadow-glow-green"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <button
                        onClick={() => setMode('host')}
                        className="bg-atari-green text-atari-black font-pixel p-4 hover:bg-atari-cyan hover:text-white transition-colors"
                    >
                        HOST GAME
                    </button>
                    <button
                        onClick={() => setMode('join')}
                        className="border-2 border-atari-pink text-atari-pink font-pixel p-4 hover:bg-atari-pink hover:text-atari-black transition-colors"
                    >
                        JOIN GAME
                    </button>
                </div>
            )}

            {mode === 'host' && (
                <div className="flex flex-col space-y-4 w-full">
                    <p className="text-atari-yellow font-mono text-center">INITIALIZING LOBBY...</p>
                    <button onClick={handleHost} className="bg-atari-green text-atari-black font-pixel p-4">START SESSION</button>
                    <button onClick={() => setMode('menu')} className="text-atari-green font-mono">BACK</button>
                </div>
            )}

            {mode === 'join' && (
                <div className="flex flex-col space-y-4 w-full">
                    <input
                        type="text"
                        placeholder="ROOM CODE"
                        maxLength={4}
                        className="bg-atari-black border-2 border-atari-pink text-atari-pink p-4 font-mono text-center text-4xl uppercase outline-none focus:shadow-glow-pink"
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value)}
                    />
                    <button onClick={handleJoin} className="bg-atari-pink text-atari-black font-pixel p-4">CONNECT</button>
                    <button onClick={() => setMode('menu')} className="text-atari-green font-mono">BACK</button>
                </div>
            )}

            {error && (
                <p className="text-atari-red font-mono bg-black p-2 border border-atari-red">{error}</p>
            )}
        </div>
    )
}
