import { useState } from 'react'
import { useGame } from '../../context/GameContext'
import { motion } from 'framer-motion'

export const Lobby = () => {
    const { createRoom, joinRoom, error } = useGame()
    const [username, setUsername] = useState('')
    const [roomCode, setRoomCode] = useState('')
    const [mode, setMode] = useState<'menu' | 'join' | 'host'>('menu')
    const [isLoading, setIsLoading] = useState(false)

    const handleHost = async () => {
        if (!username.trim()) return alert('ENTER YOUR NAME!')
        setIsLoading(true)
        await createRoom(username.trim())
        setIsLoading(false)
    }

    const handleJoin = async () => {
        if (!username.trim() || !roomCode.trim()) return alert('ENTER ALL DETAILS!')
        setIsLoading(true)
        const success = await joinRoom(roomCode.toUpperCase().trim(), username.trim())
        setIsLoading(false)
        if (!success) {
            alert('Room not found!')
        }
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 w-full max-w-md mx-auto z-10 relative">
            {/* Title */}
            <motion.h1
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-4xl md:text-6xl font-pixel text-atari-green mb-12 text-center"
                style={{ textShadow: '0 0 20px #39ff14, 0 0 40px #39ff14' }}
            >
                RETRO<br />RUSH
            </motion.h1>

            {mode === 'menu' && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex flex-col space-y-4 w-full"
                >
                    {/* Name input */}
                    <input
                        type="text"
                        placeholder="YOUR NAME"
                        maxLength={12}
                        className="bg-transparent border-2 border-atari-green text-atari-green p-4 
                       font-mono text-xl text-center outline-none 
                       focus:border-atari-cyan focus:shadow-[0_0_15px_#00ffff]
                       transition-all rounded-lg"
                        value={username}
                        onChange={e => setUsername(e.target.value.toUpperCase())}
                    />

                    {/* Host button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => username.trim() ? setMode('host') : alert('ENTER YOUR NAME FIRST!')}
                        className="bg-atari-green text-black font-pixel p-4 rounded-lg
                       hover:bg-atari-cyan transition-colors text-lg"
                        style={{ boxShadow: '0 0 15px #39ff14' }}
                    >
                        🎮 HOST GAME
                    </motion.button>

                    {/* Join button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => username.trim() ? setMode('join') : alert('ENTER YOUR NAME FIRST!')}
                        className="border-2 border-atari-pink text-atari-pink font-pixel p-4 rounded-lg
                       hover:bg-atari-pink hover:text-black transition-colors text-lg"
                    >
                        🚀 JOIN GAME
                    </motion.button>
                </motion.div>
            )}

            {mode === 'host' && (
                <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex flex-col space-y-4 w-full text-center"
                >
                    <p className="text-atari-yellow font-mono text-lg mb-4">
                        Ready to host, {username}?
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleHost}
                        disabled={isLoading}
                        className="bg-atari-green text-black font-pixel p-4 rounded-lg text-lg
                       hover:bg-atari-cyan transition-colors disabled:opacity-50"
                        style={{ boxShadow: '0 0 15px #39ff14' }}
                    >
                        {isLoading ? 'CREATING...' : 'CREATE ROOM'}
                    </motion.button>
                    <button
                        onClick={() => setMode('menu')}
                        className="text-atari-green/70 font-mono hover:text-atari-green"
                    >
                        ← BACK
                    </button>
                </motion.div>
            )}

            {mode === 'join' && (
                <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex flex-col space-y-4 w-full"
                >
                    <p className="text-atari-yellow font-mono text-center text-lg mb-2">
                        Enter the 4-letter code
                    </p>
                    <input
                        type="text"
                        placeholder="ABCD"
                        maxLength={4}
                        className="bg-transparent border-2 border-atari-pink text-atari-pink p-4 
                       font-pixel text-center text-4xl uppercase outline-none 
                       focus:border-atari-cyan focus:shadow-[0_0_15px_#00ffff]
                       tracking-[0.5em] rounded-lg"
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    />
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleJoin}
                        disabled={isLoading || roomCode.length !== 4}
                        className="bg-atari-pink text-black font-pixel p-4 rounded-lg text-lg
                       hover:bg-atari-cyan transition-colors 
                       disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'JOINING...' : 'JOIN ROOM'}
                    </motion.button>
                    <button
                        onClick={() => setMode('menu')}
                        className="text-atari-green/70 font-mono hover:text-atari-green"
                    >
                        ← BACK
                    </button>
                </motion.div>
            )}

            {error && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-atari-red font-mono bg-black/50 p-2 border border-atari-red rounded"
                >
                    ⚠️ {error}
                </motion.p>
            )}

            {/* Footer hint */}
            <p className="absolute bottom-4 text-xs text-atari-green/30 text-center">
                Works best on mobile • Scan QR to join
            </p>
        </div>
    )
}
