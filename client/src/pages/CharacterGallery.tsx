import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGameStore } from "../stores/gameStore";
import { api } from "../lib/api";
import type { Character } from "../types";

export function CharacterGallery() {
  const sessionId = useGameStore((s) => s.sessionId);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    api
      .getCharacters(sessionId)
      .then(setCharacters)
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleDelete(id: string) {
    await api.deleteCharacter(id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col min-h-screen p-6 gap-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Characters</h2>
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Back
        </Link>
      </div>

      <Link
        href="/characters/create"
        className="bg-indigo-600 hover:bg-indigo-500 text-center py-3 rounded-lg font-semibold transition-colors"
      >
        + Create New Character
      </Link>

      {/* User Characters */}
      {loading ? (
        <p className="text-center text-gray-500 py-12">Loading...</p>
      ) : characters.length === 0 ? (
        <p className="text-center text-gray-500 py-12">
          No characters yet. Create one to get started!
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {characters.map((c) => (
            <Link key={c.id} href={`/characters/${c.id}/edit`}>
              <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors">
                <div className="aspect-square bg-gray-800">
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {c.textPrompt}
                  </p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(c.id);
                    }}
                    className="text-xs text-red-400 hover:text-red-300 mt-2 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
}
