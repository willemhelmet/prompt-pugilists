import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGameStore } from "../stores/gameStore";
import { api } from "../lib/api";
import { socket, connectSocket } from "../lib/socket";
import type { Character } from "../types";

export function CharacterSelect() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, navigate] = useLocation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);

  // Fetch characters
  useEffect(() => {
    api
      .getCharacters()
      .then(setCharacters)
      .finally(() => setLoading(false));
  }, []);

  // Socket listeners
  useEffect(() => {
    connectSocket();

    function onCharacterSelected({ playerId }: { playerId: string; character: Character }) {
      // Another player selected — we don't need to track which character, just that they did
      console.log(`Player ${playerId} selected a character`);
    }

    function onBattleStart({ battle }: any) {
      useGameStore.getState().setBattle(battle);
      navigate(`/play/${roomId}`);
    }

    function onRoomFull() {
      // Room just became full — we're good
    }

    socket.on("character:selected", onCharacterSelected);
    socket.on("battle:start", onBattleStart);
    socket.on("room:full", onRoomFull);

    return () => {
      socket.off("character:selected", onCharacterSelected);
      socket.off("battle:start", onBattleStart);
      socket.off("room:full", onRoomFull);
    };
  }, [roomId, navigate]);

  function handleSelect(characterId: string) {
    setSelectedId(characterId);
    socket.emit("character:select", { roomId: roomId!, characterId });
  }

  function handleReady() {
    if (!selectedId) return;
    setReady(true);
    socket.emit("player:ready", { roomId: roomId! });
  }

  return (
    <div className="flex flex-col min-h-screen p-6 gap-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold">Select Your Fighter</h2>
      <p className="text-gray-400 text-sm">Room: {roomId}</p>

      {loading ? (
        <p className="text-center text-gray-500 py-12">Loading characters...</p>
      ) : characters.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            You don't have any characters yet!
          </p>
          <a
            href="/characters/create"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            Create one in a new tab
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              disabled={ready}
              className={`bg-gray-900 border rounded-lg overflow-hidden text-left transition-colors ${
                selectedId === c.id
                  ? "border-indigo-500 ring-2 ring-indigo-500/50"
                  : "border-gray-700 hover:border-gray-500"
              } ${ready ? "opacity-60" : ""}`}
            >
              <div className="aspect-square bg-gray-800">
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <p className="font-semibold truncate">{c.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleReady}
        disabled={!selectedId || ready}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 py-3 rounded-lg font-semibold transition-colors"
      >
        {ready ? "Waiting for opponent..." : "Ready"}
      </button>
    </div>
  );
}
