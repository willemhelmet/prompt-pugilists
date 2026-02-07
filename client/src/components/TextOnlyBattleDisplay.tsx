import type { Battle, BattleResolution } from "../types";

interface TextOnlyBattleDisplayProps {
  battle: Battle | null;
  lastResolution: BattleResolution | null;
  resolving: boolean;
  winner: string | null;
  roomId: string;
  onBackToMenu: () => void;
}

export function TextOnlyBattleDisplay({
  battle,
  lastResolution,
  resolving,
  winner,
  roomId,
  onBackToMenu,
}: TextOnlyBattleDisplayProps) {
  const p1 = battle?.player1;
  const p2 = battle?.player2;

  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      {winner ? (
        <div className="text-center">
          <div className="flex items-center justify-center gap-8 mb-6">
            {p1 && p2 && (() => {
              const winnerChar = p1.playerId === winner ? p1.character : p2.character;
              const loserChar = p1.playerId === winner ? p2.character : p1.character;
              return (
                <>
                  <div className="flex flex-col items-center">
                    <img
                      src={winnerChar.imageUrl}
                      alt={winnerChar.name}
                      className="w-24 h-24 rounded-full border-4 border-amber-400 shadow-lg shadow-amber-400/30 object-cover"
                    />
                    <span className="text-amber-400 text-sm font-semibold mt-2">Winner</span>
                  </div>
                  <span className="text-3xl text-gray-600 font-bold">VS</span>
                  <div className="flex flex-col items-center opacity-50">
                    <img
                      src={loserChar.imageUrl}
                      alt={loserChar.name}
                      className="w-24 h-24 rounded-full border-4 border-gray-600 object-cover grayscale"
                    />
                    <span className="text-gray-500 text-sm mt-2">Defeated</span>
                  </div>
                </>
              );
            })()}
          </div>
          <p
            className="text-5xl font-extrabold mb-3"
            style={{
              color: "#fbbf24",
              textShadow: "0 0 20px rgba(251,191,36,0.5), 0 2px 4px rgba(0,0,0,0.8)",
            }}
          >
            {p1!.playerId === winner ? p1!.character.name : p2!.character.name} Wins!
          </p>
          <p className="text-amber-200/60 mb-5 text-lg">Victory!</p>
          <button
            onClick={onBackToMenu}
            className="bg-indigo-600 hover:bg-indigo-500 py-3 px-8 rounded-lg font-semibold transition-colors"
          >
            Back to Menu
          </button>
        </div>
      ) : resolving ? (
        <p className="text-indigo-400 text-xl animate-pulse">Resolving round...</p>
      ) : battle ? (
        <div className="text-center p-6 max-w-md">
          <p className="text-gray-300 mb-4">{battle.currentState.environmentDescription}</p>
          {lastResolution && (
            <>
              <p className="text-gray-400 text-sm mb-2">{lastResolution.interpretation}</p>
              <div className="flex gap-4 justify-center text-xs text-gray-500">
                {lastResolution.diceRolls.map((roll, i) => (
                  <span key={i}>{roll.purpose}: {roll.result}</span>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-2">Waiting for players...</p>
          <p className="text-gray-600 text-sm">
            Share the room code: <span className="font-mono text-indigo-400 font-bold">{roomId}</span>
          </p>
        </div>
      )}
    </div>
  );
}
