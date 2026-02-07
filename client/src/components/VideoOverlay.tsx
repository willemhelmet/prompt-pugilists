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
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-amber-900/30 via-black/40 to-amber-900/30 z-10">
        <div className="text-center">
          <p
            className="text-6xl font-extrabold mb-3 animate-pulse"
            style={{
              color: "#fbbf24",
              textShadow: "0 0 20px rgba(251,191,36,0.6), 0 0 40px rgba(251,191,36,0.3), 0 2px 4px rgba(0,0,0,0.8)",
            }}
          >
            {winnerName} Wins!
          </p>
          <p className="text-amber-200/80 mb-5 text-lg tracking-wide">Victory!</p>
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
      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 z-10">
        <p className="text-indigo-300 text-sm animate-pulse">Resolving round...</p>
      </div>
    );
  }

  return null;
}
