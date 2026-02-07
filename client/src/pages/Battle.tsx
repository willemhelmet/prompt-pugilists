import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ACTION_CHAR_LIMIT } from "../types";
import type { Battle as BattleType, BattleResolution } from "../types";
import { socket, connectSocket } from "../lib/socket";
import { useGameStore } from "../stores/gameStore";

export function Battle() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, navigate] = useLocation();
  const [action, setAction] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [lastResolution, setLastResolution] = useState<BattleResolution | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [generatingAction, setGeneratingAction] = useState(false);

  const battle = useGameStore((s) => s.battle);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const setBattle = useGameStore((s) => s.setBattle);

  const myPlayer = battle && playerSlot ? battle[playerSlot] : null;
  const opponentSlot = playerSlot === "player1" ? "player2" : "player1";
  const opponent = battle ? battle[opponentSlot] : null;

  useEffect(() => {
    connectSocket();

    function onBattleStart({ battle }: { battle: BattleType }) {
      setBattle(battle);
    }

    function onActionReceived({ playerId }: { playerId: string }) {
      // If it's not us, opponent submitted
      if (myPlayer && playerId !== myPlayer.playerId) {
        setOpponentSubmitted(true);
      }
    }

    function onResolving() {
      setResolving(true);
    }

    function onRoundComplete({ battle, resolution }: { battle: BattleType; resolution: BattleResolution }) {
      setBattle(battle);
      setLastResolution(resolution);
      setResolving(false);
      setSubmitted(false);
      setOpponentSubmitted(false);
      setAction("");
    }

    function onBattleEnd({ winnerId, battle, finalResolution }: { winnerId: string; battle: BattleType; finalResolution: BattleResolution }) {
      setBattle(battle);
      setLastResolution(finalResolution);
      setResolving(false);
      setWinner(winnerId);
    }

    function onActionGenerated({ suggestedAction }: { playerId: string; suggestedAction: string }) {
      setAction(suggestedAction);
      setGeneratingAction(false);
    }

    socket.on("battle:start", onBattleStart);
    socket.on("battle:action_received", onActionReceived);
    socket.on("battle:resolving", onResolving);
    socket.on("battle:round_complete", onRoundComplete);
    socket.on("battle:end", onBattleEnd);
    socket.on("battle:action_generated", onActionGenerated);

    return () => {
      socket.off("battle:start", onBattleStart);
      socket.off("battle:action_received", onActionReceived);
      socket.off("battle:resolving", onResolving);
      socket.off("battle:round_complete", onRoundComplete);
      socket.off("battle:end", onBattleEnd);
      socket.off("battle:action_generated", onActionGenerated);
    };
  }, [myPlayer, setBattle]);

  function handleGenerateAction() {
    setGeneratingAction(true);
    socket.emit("battle:generate_action", { roomId: roomId! });
  }

  function handleSubmit() {
    if (!action.trim() || submitted) return;
    setSubmitted(true);
    socket.emit("battle:action", { roomId: roomId!, actionText: action.trim() });
  }

  if (!battle || !myPlayer || !opponent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading battle...</p>
      </div>
    );
  }

  const myHpPct = (myPlayer.currentHp / myPlayer.maxHp) * 100;
  const opHpPct = (opponent.currentHp / opponent.maxHp) * 100;
  const iWon = winner === myPlayer.playerId;

  return (
    <div className="flex flex-col min-h-screen p-4 gap-4 max-w-lg mx-auto">
      {/* HP bars */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-semibold text-sm">{myPlayer.character.name} (You)</p>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${myHpPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {myPlayer.currentHp}/{myPlayer.maxHp} HP
          </p>
        </div>
        <div className="px-3 pt-2 text-gray-600 font-bold">VS</div>
        <div className="flex-1 text-right">
          <p className="font-semibold text-sm">{opponent.character.name}</p>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${opHpPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {opponent.currentHp}/{opponent.maxHp} HP
          </p>
        </div>
      </div>

      {/* Battle state */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm">
        <p className="text-gray-300">{battle.currentState.environmentDescription}</p>
        {lastResolution && (
          <div className="mt-2 pt-2 border-t border-gray-800">
            <p className="text-indigo-300 text-xs font-semibold mb-1">Last round:</p>
            <p className="text-gray-400 text-xs">{lastResolution.interpretation}</p>
            {lastResolution.diceRolls.map((roll, i) => (
              <p key={i} className="text-gray-500 text-xs">
                {roll.purpose}: {roll.formula} = {roll.result}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Winner overlay */}
      {winner ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-3xl font-bold">
            {iWon ? "You Win!" : "You Lose!"}
          </p>
          <p className="text-gray-400">
            {iWon ? opponent.character.name : myPlayer.character.name} has been defeated.
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-indigo-600 hover:bg-indigo-500 py-3 px-8 rounded-lg font-semibold transition-colors"
          >
            Back to Home
          </button>
        </div>
      ) : resolving ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-indigo-400 text-lg animate-pulse">Resolving round...</p>
        </div>
      ) : (
        <>
          {/* Action input */}
          <div className="flex-1 flex flex-col gap-3">
            <label className="text-sm text-gray-400">Describe your action:</label>
            <textarea
              value={action}
              onChange={(e) => setAction(e.target.value.slice(0, ACTION_CHAR_LIMIT))}
              disabled={submitted}
              className="flex-1 min-h-[120px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              placeholder="I channel all my remaining power into a desperate final inferno..."
            />
            <p className="text-xs text-gray-500">
              {action.length}/{ACTION_CHAR_LIMIT}
            </p>
          </div>

          {/* Status indicators */}
          <div className="flex gap-4 text-xs">
            <span className={submitted ? "text-green-400" : "text-gray-500"}>
              {submitted ? "Action submitted" : "Waiting for your action"}
            </span>
            <span className={opponentSubmitted ? "text-green-400" : "text-gray-500"}>
              {opponentSubmitted ? "Opponent ready" : "Opponent thinking..."}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerateAction}
              disabled={submitted || generatingAction || !!winner}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 py-3 px-4 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {generatingAction ? "Generating..." : "✦ Generate Action"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!action.trim() || submitted}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 py-3 rounded-lg font-semibold text-lg transition-colors"
            >
              {submitted ? "Waiting for opponent..." : "Submit Action"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
