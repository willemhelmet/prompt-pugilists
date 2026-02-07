import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { socket, connectSocket } from "../lib/socket";
import { useGameStore } from "../stores/gameStore";
import { ReactorVideoSection } from "../components/ReactorVideoSection";
import type { PlayerConnection, Battle, BattleResolution } from "../types";

export function HostDisplay() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, navigate] = useLocation();
  const { room, player1, player2, setPlayer } = useGameStore();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [lastResolution, setLastResolution] = useState<BattleResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  useEffect(() => {
    connectSocket();

    function onPlayerJoined({ player, playerSlot }: { player: PlayerConnection; playerSlot: "player1" | "player2" }) {
      setPlayer(playerSlot, player);
      addLog(`${player.username} joined as ${playerSlot}`);
    }

    function onRoomFull() {
      addLog("Room full — waiting for character selection");
    }

    function onBattleStart({ battle }: { battle: Battle }) {
      setBattle(battle);
      addLog(`Battle started: ${battle.player1.character.name} vs ${battle.player2.character.name}`);
    }

    function onActionReceived({ playerId }: { playerId: string }) {
      addLog(`Player ${playerId.slice(0, 6)}... submitted action`);
    }

    function onResolving() {
      setResolving(true);
      addLog("Resolving round...");
    }

    function onRoundComplete({ battle, resolution }: { battle: Battle; resolution: BattleResolution }) {
      setBattle(battle);
      setLastResolution(resolution);
      setResolving(false);
      addLog(resolution.interpretation);
    }

    function onBattleEnd({ winnerId, battle, finalResolution }: { winnerId: string; battle: Battle; finalResolution: BattleResolution }) {
      setBattle(battle);
      setLastResolution(finalResolution);
      setResolving(false);
      setWinner(winnerId);
      const winnerName =
        battle.player1.playerId === winnerId
          ? battle.player1.character.name
          : battle.player2.character.name;
      addLog(`${winnerName} wins!`);
    }

    socket.on("room:player_joined", onPlayerJoined);
    socket.on("room:full", onRoomFull);
    socket.on("battle:start", onBattleStart);
    socket.on("battle:action_received", onActionReceived);
    socket.on("battle:resolving", onResolving);
    socket.on("battle:round_complete", onRoundComplete);
    socket.on("battle:end", onBattleEnd);

    return () => {
      socket.off("room:player_joined", onPlayerJoined);
      socket.off("room:full", onRoomFull);
      socket.off("battle:start", onBattleStart);
      socket.off("battle:action_received", onActionReceived);
      socket.off("battle:resolving", onResolving);
      socket.off("battle:round_complete", onRoundComplete);
      socket.off("battle:end", onBattleEnd);
    };
  }, [setPlayer]);

  const p1 = battle?.player1;
  const p2 = battle?.player2;

  return (
    <div className="flex flex-col min-h-screen p-4 gap-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">
          Room Code:{" "}
          <span className="font-mono text-white text-3xl font-bold tracking-widest">{roomId}</span>
        </span>
        <span className="text-sm text-gray-400">
          {battle ? `Round ${battle.resolutionHistory.length + 1}` : ""}
        </span>
      </div>

      {/* Player HP bars (only shown once battle starts) */}
      {battle ? (
        <div className="flex justify-between items-start">
          <HpBar name={p1!.character.name} hp={p1!.currentHp} maxHp={p1!.maxHp} color="green" />
          <div className="px-4 pt-2 text-gray-600 font-bold text-xl">VS</div>
          <HpBar name={p2!.character.name} hp={p2!.currentHp} maxHp={p2!.maxHp} color="red" align="right" />
        </div>
      ) : (
        <div className="flex gap-4">
          <PlayerSlot label="Player 1" player={player1} />
          <div className="flex items-center text-gray-600 font-bold text-xl">VS</div>
          <PlayerSlot label="Player 2" player={player2} />
        </div>
      )}

      {/* Main area */}
      <ReactorVideoSection
        battle={battle}
        lastResolution={lastResolution}
        resolving={resolving}
        winner={winner}
        roomId={roomId!}
        onBackToMenu={() => navigate("/")}
      />

      {/* Log */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 h-36 overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-gray-500 text-sm">Waiting for players to join...</p>
        ) : (
          log.map((msg, i) => (
            <p key={i} className="text-gray-400 text-sm">{msg}</p>
          ))
        )}
      </div>
    </div>
  );
}

function HpBar({ name, hp, maxHp, color, align }: { name: string; hp: number; maxHp: number; color: string; align?: string }) {
  const pct = (hp / maxHp) * 100;
  return (
    <div className={`flex-1 ${align === "right" ? "text-right" : ""}`}>
      <p className="font-semibold">{name}</p>
      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color === "green" ? "bg-green-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{hp}/{maxHp} HP</p>
    </div>
  );
}

function PlayerSlot({ label, player }: { label: string; player: PlayerConnection | null }) {
  return (
    <div className={`flex-1 rounded-lg p-4 border ${player ? "bg-gray-900 border-green-800" : "bg-gray-900/50 border-gray-800 border-dashed"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {player ? (
        <p className="font-semibold text-white">{player.username}</p>
      ) : (
        <p className="text-gray-600 italic">Waiting...</p>
      )}
    </div>
  );
}
