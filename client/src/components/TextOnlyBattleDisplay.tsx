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
    <div className="flex-1 bg-gray-900 rounded-xl flex items-center justify-center border border-gray-800 min-h-[300px]">
      {winner ? (
        <div className="text-center">
          <p className="text-4xl font-bold mb-2">
            {p1!.playerId === winner ? p1!.character.name : p2!.character.name} Wins!
          </p>
          <p className="text-gray-400 mb-4">Battle complete</p>
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
