import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ROOM_CODE_LENGTH } from "../types";
import { socket, connectSocket } from "../lib/socket";
import { useGameStore } from "../stores/gameStore";

export function Join() {
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [joining, setJoining] = useState(false);
  const [, navigate] = useLocation();
  const { setRoom, setPlayerSlot, setError, error } = useGameStore();

  useEffect(() => {
    connectSocket();

    function onPlayerJoined({ player, playerSlot }: { player: any; playerSlot: "player1" | "player2" }) {
      // Only navigate if this is us (our socket)
      if (player.connectionId === socket.id) {
        setPlayerSlot(playerSlot);
        navigate(`/play/${roomCode.toUpperCase()}/select`);
      }
    }

    function onError({ message }: { message: string }) {
      setError(message);
      setJoining(false);
    }

    socket.on("room:player_joined", onPlayerJoined);
    socket.on("room:error", onError);

    return () => {
      socket.off("room:player_joined", onPlayerJoined);
      socket.off("room:error", onError);
    };
  }, [roomCode, navigate, setRoom, setPlayerSlot, setError]);

  function handleJoin() {
    if (!roomCode.trim() || !username.trim() || joining) return;
    setError(null);
    setJoining(true);
    socket.emit("room:join", { roomId: roomCode.toUpperCase(), username: username.trim() });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6 max-w-sm mx-auto">
      <div className="flex justify-between items-center w-full">
        <h2 className="text-2xl font-bold">Join Game</h2>
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Back
        </Link>
      </div>

      {error && (
        <div className="w-full bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="w-full">
        <label className="block text-sm text-gray-400 mb-2">Your Name</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
          placeholder="Enter your name"
          maxLength={20}
        />
      </div>

      <div className="w-full">
        <label className="block text-sm text-gray-400 mb-2">Room Code</label>
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, ROOM_CODE_LENGTH))}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-indigo-500"
          placeholder="A3K9ZX"
          maxLength={ROOM_CODE_LENGTH}
        />
      </div>

      <button
        onClick={handleJoin}
        disabled={!roomCode.trim() || !username.trim() || joining}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 py-3 rounded-lg font-semibold text-lg transition-colors"
      >
        {joining ? "Joining..." : "Join Game"}
      </button>
    </div>
  );
}
