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
  const { announce, muted, toggleMute, isSpeaking, available } = useAnnouncer();
  const announceRef = useRef(announce);
  announceRef.current = announce;

  useEffect(() => {
    connectSocket();

    function onPlayerJoined({ player, playerSlot }: { player: PlayerConnection; playerSlot: "player1" | "player2" }) {
      setPlayer(playerSlot, player);
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
      announceRef.current(`And stepping into the arena... it's ${character.name}!`);
    }

    function onBattleStart({ battle }: { battle: Battle }) {
      setBattle(battle);
      announceRef.current(
        `Ladies and gentlemen! ${battle.player1.character.name} versus ${battle.player2.character.name}! Let the battle BEGIN!`,
      );
    }

    function onResolving() {
      setResolving(true);
    }

    function onRoundComplete({ battle, resolution }: { battle: Battle; resolution: BattleResolution }) {
      setBattle(battle);
      setLastResolution(resolution);
      setResolving(false);
    }

    function onBattleEnd({ winnerId, battle, finalResolution }: { winnerId: string; battle: Battle; finalResolution: BattleResolution }) {
      setBattle(battle);
      setLastResolution(finalResolution);
      setResolving(false);
      setWinner(winnerId);
    }

    function onNarratorAudio({ narratorScript }: { narratorScript: string }) {
      announceRef.current(narratorScript);
    }

    socket.on("room:player_joined", onPlayerJoined);
    socket.on("character:selected", onCharacterSelected);
    socket.on("room:full", () => {});
    socket.on("battle:start", onBattleStart);
    socket.on("battle:action_received", () => {});
    socket.on("battle:resolving", onResolving);
    socket.on("battle:round_complete", onRoundComplete);
    socket.on("battle:end", onBattleEnd);
    socket.on("battle:narrator_audio", onNarratorAudio);

    return () => {
      socket.off("room:player_joined", onPlayerJoined);
      socket.off("character:selected", onCharacterSelected);
      socket.off("room:full");
      socket.off("battle:start", onBattleStart);
      socket.off("battle:action_received");
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
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Video base layer — fills entire viewport */}
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

      {/* Top bar overlay: room code (left), announcer + round (right) */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20 pointer-events-none">
        <span className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm text-gray-300 pointer-events-auto">
          Room: <span className="font-mono text-white font-bold tracking-wider">{roomId}</span>
        </span>
        <div className="flex items-center gap-3 pointer-events-auto">
          {available && (
            <button
              onClick={toggleMute}
              className={`text-xs px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors ${
                muted
                  ? "bg-black/50 text-gray-500 hover:text-gray-300"
                  : isSpeaking
                    ? "bg-yellow-900/50 text-yellow-400 animate-pulse"
                    : "bg-black/50 text-green-400 hover:text-green-300"
              }`}
            >
              {muted ? "Announcer OFF" : isSpeaking ? "Announcing..." : "Announcer ON"}
            </button>
          )}
          {battle && (
            <span className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm text-gray-300">
              Round {battle.resolutionHistory.length + 1}
            </span>
          )}
        </div>
      </div>

      {/* HP bars overlay (only during battle) */}
      {battle && (
        <div className="absolute top-16 left-4 right-4 z-20 pointer-events-none">
          <div className="flex items-center gap-3">
            <HpBar name={p1!.character.name} hp={p1!.currentHp} maxHp={p1!.maxHp} color="green" imageUrl={p1!.character.imageUrl} />
            <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-gray-400 font-bold text-lg shrink-0">
              VS
            </div>
            <HpBar name={p2!.character.name} hp={p2!.currentHp} maxHp={p2!.maxHp} color="red" align="right" imageUrl={p2!.character.imageUrl} />
          </div>
        </div>
      )}

      {/* Pre-battle: player slot cards overlay */}
      {!battle && (
        <div className="absolute bottom-8 left-4 right-4 z-20 pointer-events-none">
          <div className="flex gap-4 justify-center">
            <PlayerSlot label="Player 1" player={player1} selectedChar={selectedCharacters.find(sc => sc.playerSlot === "player1")} />
            <div className="flex items-center text-gray-500 font-bold text-xl">VS</div>
            <PlayerSlot label="Player 2" player={player2} selectedChar={selectedCharacters.find(sc => sc.playerSlot === "player2")} />
          </div>
        </div>
      )}
    </div>
  );
}

function HpBar({ name, hp, maxHp, color, align, imageUrl }: { name: string; hp: number; maxHp: number; color: string; align?: string; imageUrl: string }) {
  const pct = (hp / maxHp) * 100;
  const isRight = align === "right";
  return (
    <div className={`flex-1 flex items-center gap-3 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
      <img
        src={imageUrl}
        alt={name}
        className={`w-14 h-14 rounded-full object-cover border-2 shrink-0 ${
          color === "green"
            ? "border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
            : "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
        }`}
      />
      <div className={`flex-1 ${isRight ? "text-right" : ""}`}>
        <p className="font-semibold text-white text-sm drop-shadow-lg">{name}</p>
        <div className="w-full h-4 bg-black/50 backdrop-blur-sm rounded-full overflow-hidden mt-1 border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color === "green" ? "bg-green-500 shadow-green-500/50 shadow-md" : "bg-red-500 shadow-red-500/50 shadow-md"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-300 mt-1 drop-shadow">{hp}/{maxHp} HP</p>
      </div>
    </div>
  );
}

function PlayerSlot({ label, player, selectedChar }: { label: string; player: PlayerConnection | null; selectedChar?: SelectedCharacter }) {
  return (
    <div className={`w-56 rounded-lg p-4 backdrop-blur-sm ${player ? "bg-black/50 border border-green-800/50" : "bg-black/30 border border-gray-700/50 border-dashed"}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
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
        <p className="text-gray-500 italic">Waiting...</p>
      )}
    </div>
  );
}
