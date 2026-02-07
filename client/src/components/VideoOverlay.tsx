import type { Battle } from "../types";

interface VideoOverlayProps {
  battle: Battle;
  resolving: boolean;
  winner: string | null;
  onBackToMenu: () => void;
}

export function VideoOverlay({ battle, resolving, winner, onBackToMenu }: VideoOverlayProps) {
  const p1 = battle.player1;
  const p2 = battle.player2;

  if (winner) {
    const winnerName = p1.playerId === winner ? p1.character.name : p2.character.name;
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
        <div className="text-center">
          <p className="text-4xl font-bold mb-2 text-white drop-shadow-lg">{winnerName} Wins!</p>
          <p className="text-gray-300 mb-4">Battle complete</p>
          <button
            onClick={onBackToMenu}
            className="bg-indigo-600 hover:bg-indigo-500 py-3 px-8 rounded-lg font-semibold transition-colors"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (resolving) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
        <p className="text-indigo-300 text-xl animate-pulse drop-shadow-lg">Resolving round...</p>
      </div>
    );
  }

  return null;
}
