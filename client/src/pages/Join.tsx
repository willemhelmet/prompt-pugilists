import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ROOM_CODE_LENGTH } from "../types";
import { socket, connectSocket } from "../lib/socket";
import { useGameStore } from "../stores/gameStore";
import { api } from "../lib/api";
import type { Character } from "../types";

export function Join() {
  const [roomCode, setRoomCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [, navigate] = useLocation();
  const sessionId = useGameStore((s) => s.sessionId);
  const { setPlayerSlot, setError, setBattle, error } = useGameStore();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingChars, setLoadingChars] = useState(true);

  // Fetch user's characters
  useEffect(() => {
    if (!sessionId) return;
    api
      .getCharacters(sessionId)
      .then(setCharacters)
      .finally(() => setLoadingChars(false));
  }, [sessionId]);

  // Socket listeners
  useEffect(() => {
    connectSocket();

    function onBattleStart({ battle }: any) {
      setBattle(battle);
      navigate(`/play/${roomCode.toUpperCase()}`);
    }

    function onError({ message }: { message: string }) {
      setError(message);
      setJoining(false);
    }

    socket.on("battle:start", onBattleStart);
    socket.on("room:error", onError);

    return () => {
      socket.off("battle:start", onBattleStart);
      socket.off("room:error", onError);
    };
  }, [roomCode, navigate, setBattle, setError]);

  const selectedCharacter = characters.find((c) => c.id === selectedId);

  function handleJoin() {
    if (!roomCode.trim() || !selectedId || !selectedCharacter || joining) return;
    setError(null);
    setJoining(true);

    const code = roomCode.toUpperCase();

    socket.emit("room:join", {
      roomId: code,
      username: selectedCharacter.name,
    });

    socket.once("room:player_joined", ({ player, playerSlot }) => {
      if (player.connectionId === socket.id) {
        setPlayerSlot(playerSlot);
        socket.emit("character:select", {
          roomId: code,
          characterId: selectedId,
        });
        socket.emit("player:ready", { roomId: code });
      }
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden font-body">
      {/* ── Background atmosphere ── */}
      <div className="fixed inset-0 bg-gray-950">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-indigo-600/15 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 -right-32 w-[500px] h-[400px] bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -left-40 w-[350px] h-[350px] bg-fuchsia-600/[0.07] rounded-full blur-[120px]" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-8 pb-14 gap-7 max-w-xl mx-auto">
        {/* Back button */}
        <Link
          href="/"
          className="self-start flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors animate-fade-in"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </Link>

        {/* Header */}
        <header className="text-center animate-fade-in -mt-2">
          <div className="flex items-center justify-center gap-3 mb-1">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-indigo-500/50" />
            <p className="text-[11px] tracking-[0.3em] uppercase text-indigo-400/60 font-medium">
              Multiplayer
            </p>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-indigo-500/50" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight uppercase leading-none">
            Join Game
          </h1>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="w-full bg-red-950/50 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm flex items-start gap-2.5 animate-fade-in">
            <svg
              className="w-4 h-4 mt-0.5 shrink-0 text-red-400/80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Room Code ── */}
        <div
          className="w-full animate-slide-up"
          style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
        >
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <label className="text-[11px] tracking-[0.15em] uppercase text-gray-500 font-medium">
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) =>
                setRoomCode(
                  e.target.value.toUpperCase().slice(0, ROOM_CODE_LENGTH),
                )
              }
              disabled={joining}
              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-white text-center text-3xl font-display tracking-[0.3em] uppercase focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 placeholder:tracking-[0.3em] disabled:opacity-50"
              placeholder="A3K9ZX"
              maxLength={ROOM_CODE_LENGTH}
            />
          </div>
        </div>

        {/* ── Choose Your Fighter ── */}
        <div
          className="w-full animate-slide-up"
          style={{ animationDelay: "0.2s", animationFillMode: "backwards" }}
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <p className="text-[11px] tracking-[0.25em] uppercase text-gray-500 font-medium">
              Choose Your Fighter
            </p>
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>

          {loadingChars ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm text-gray-500 tracking-wide">
                Loading fighters&hellip;
              </p>
            </div>
          ) : characters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
              <svg
                className="w-10 h-10 text-gray-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              <p className="text-gray-500 text-sm text-center leading-relaxed max-w-xs">
                No fighters yet!
              </p>
              <a
                href="/characters/create"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 text-xs underline underline-offset-2 transition-colors"
              >
                Create one in a new tab
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  disabled={joining}
                  className={`group relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer disabled:cursor-default disabled:opacity-50 ${
                    selectedId === c.id
                      ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-950 scale-[0.97]"
                      : "hover:scale-[1.03] hover:ring-1 hover:ring-white/20"
                  }`}
                >
                  <div className="aspect-square bg-gray-800 overflow-hidden">
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-[11px] font-semibold text-white/90 leading-tight truncate">
                      {c.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── CTA: Join & Fight ── */}
        <div
          className="w-full pt-2 animate-slide-up"
          style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}
        >
          <button
            onClick={handleJoin}
            disabled={!roomCode.trim() || !selectedId || joining}
            className="group relative w-full overflow-hidden py-4 rounded-2xl font-display text-2xl uppercase tracking-wider font-bold transition-all disabled:opacity-25 disabled:cursor-default cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer transition-all group-hover:brightness-110" />
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer opacity-40 blur-xl" />
            <span className="relative z-10 drop-shadow-lg">
              {joining ? "Waiting for Opponent\u2026" : "Join & Fight"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
