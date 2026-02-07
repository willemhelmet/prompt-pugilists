import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { socket, connectSocket } from "../lib/socket";
import { useGameStore } from "../stores/gameStore";
import { ReactorVideoSection } from "../components/ReactorVideoSection";
import { useAnnouncer } from "../hooks/useAnnouncer";
import type { PlayerConnection, Battle, BattleResolution, Character, SelectedCharacter } from "../types";

export function HostDisplay() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, navigate] = useLocation();
  const { room, player1, player2, setPlayer } = useGameStore();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [lastResolution, setLastResolution] = useState<BattleResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [selectedCharacters, setSelectedCharacters] = useState<SelectedCharacter[]>([]);
  const arenaAnnouncedRef = useRef(false);
  interface LogEntry {
    type: "info" | "narrative" | "damage";
    text: string;
  }
  const [log, setLog] = useState<LogEntry[]>([]);
  const { announce, muted, toggleMute, isSpeaking, available } = useAnnouncer();
  const announceRef = useRef(announce);
  announceRef.current = announce;

  function addLog(msg: string, type: LogEntry["type"] = "info") {
    setLog((prev) => [...prev, { type, text: msg }]);
  }

  useEffect(() => {
    connectSocket();

    function onPlayerJoined({ player, playerSlot }: { player: PlayerConnection; playerSlot: "player1" | "player2" }) {
      setPlayer(playerSlot, player);
      addLog(`${player.username} joined as ${playerSlot}`);
    }

    function onCharacterSelected({ playerId, character }: { playerId: string; character: Character }) {
      const { player1: p1, player2: p2 } = useGameStore.getState();
      const slot = p1?.playerId === playerId ? "player1"
                 : p2?.playerId === playerId ? "player2"
                 : null;
      if (!slot) return;

      setSelectedCharacters(prev => {
        const filtered = prev.filter(sc => sc.playerId !== playerId);
        return [...filtered, { playerId, character, playerSlot: slot }];
      });
      addLog(`${character.name} enters the arena!`);
      announceRef.current(`And stepping into the arena... it's ${character.name}!`);
    }

    function onRoomFull() {
      addLog("Room full — waiting for character selection");
    }

    function onBattleStart({ battle }: { battle: Battle }) {
      setBattle(battle);
      addLog(`Battle started: ${battle.player1.character.name} vs ${battle.player2.character.name}`);
      announceRef.current(
        `Ladies and gentlemen! ${battle.player1.character.name} versus ${battle.player2.character.name}! Let the battle BEGIN!`,
      );
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
      addLog(resolution.interpretation, "narrative");
      const p1Dmg = resolution.player1HpChange;
      const p2Dmg = resolution.player2HpChange;
      if (p1Dmg !== 0 || p2Dmg !== 0) {
        const parts: string[] = [];
        if (p1Dmg < 0) parts.push(`${battle.player1.character.name} ${p1Dmg} HP`);
        if (p1Dmg > 0) parts.push(`${battle.player1.character.name} +${p1Dmg} HP`);
        if (p2Dmg < 0) parts.push(`${battle.player2.character.name} ${p2Dmg} HP`);
        if (p2Dmg > 0) parts.push(`${battle.player2.character.name} +${p2Dmg} HP`);
        addLog(parts.join(" | "), "damage");
      }
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

    function onNarratorAudio({ narratorScript }: { narratorScript: string }) {
      announceRef.current(narratorScript);
    }

    socket.on("room:player_joined", onPlayerJoined);
    socket.on("character:selected", onCharacterSelected);
    socket.on("room:full", onRoomFull);
    socket.on("battle:start", onBattleStart);
    socket.on("battle:action_received", onActionReceived);
    socket.on("battle:resolving", onResolving);
    socket.on("battle:round_complete", onRoundComplete);
    socket.on("battle:end", onBattleEnd);
    socket.on("battle:narrator_audio", onNarratorAudio);

    return () => {
      socket.off("room:player_joined", onPlayerJoined);
      socket.off("character:selected", onCharacterSelected);
      socket.off("room:full", onRoomFull);
      socket.off("battle:start", onBattleStart);
      socket.off("battle:action_received", onActionReceived);
      socket.off("battle:resolving", onResolving);
      socket.off("battle:round_complete", onRoundComplete);
      socket.off("battle:end", onBattleEnd);
      socket.off("battle:narrator_audio", onNarratorAudio);
    };
  }, [setPlayer]);

  // Announce the arena environment when it becomes available
  useEffect(() => {
    if (!room?.environment || arenaAnnouncedRef.current) return;
    arenaAnnouncedRef.current = true;
    announceRef.current(`Welcome, fight fans, to tonight's arena! ${room.environment}. Who will dare to step into this battlefield?`);
  }, [room?.environment]);

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
        <div className="flex items-center gap-3">
          {available && (
            <button
              onClick={toggleMute}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                muted
                  ? "border-gray-600 text-gray-500 hover:border-gray-400"
                  : isSpeaking
                    ? "border-yellow-600 text-yellow-400 animate-pulse"
                    : "border-green-700 text-green-400 hover:border-green-500"
              }`}
            >
              {muted ? "Announcer OFF" : isSpeaking ? "Announcing..." : "Announcer ON"}
            </button>
          )}
          <span className="text-sm text-gray-400">
            {battle ? `Round ${battle.resolutionHistory.length + 1}` : ""}
          </span>
        </div>
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
          <PlayerSlot label="Player 1" player={player1} selectedChar={selectedCharacters.find(sc => sc.playerSlot === "player1")} />
          <div className="flex items-center text-gray-600 font-bold text-xl">VS</div>
          <PlayerSlot label="Player 2" player={player2} selectedChar={selectedCharacters.find(sc => sc.playerSlot === "player2")} />
        </div>
      )}

      {/* Main area */}
      <ReactorVideoSection
        battle={battle}
        environment={room?.environment ?? null}
        selectedCharacters={selectedCharacters}
        lastResolution={lastResolution}
        resolving={resolving}
        winner={winner}
        roomId={roomId!}
        onBackToMenu={() => navigate("/")}
      />

      {/* Log */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 h-44 overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-gray-500 text-sm">Waiting for players to join...</p>
        ) : (
          log.map((entry, i) => (
            <p
              key={i}
              className={`text-sm ${
                entry.type === "narrative"
                  ? "text-indigo-300 mt-2"
                  : entry.type === "damage"
                    ? "text-red-400 text-xs font-mono"
                    : "text-gray-400"
              }`}
            >
              {entry.text}
            </p>
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

function PlayerSlot({ label, player, selectedChar }: { label: string; player: PlayerConnection | null; selectedChar?: SelectedCharacter }) {
  return (
    <div className={`flex-1 rounded-lg p-4 border ${player ? "bg-gray-900 border-green-800" : "bg-gray-900/50 border-gray-800 border-dashed"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {player ? (
        <div>
          <p className="font-semibold text-white">{player.username}</p>
          {selectedChar && (
            <div className="flex items-center gap-2 mt-2">
              <img src={selectedChar.character.imageUrl} alt={selectedChar.character.name} className="w-8 h-8 rounded-full object-cover" />
              <p className="text-sm text-indigo-300">{selectedChar.character.name}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-600 italic">Waiting...</p>
      )}
    </div>
  );
}
