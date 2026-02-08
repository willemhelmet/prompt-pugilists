import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api } from "../lib/api";
import type { Character } from "../types";

export function CharacterGallery() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCharacters()
      .then(setCharacters)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    await api.deleteCharacter(id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
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
              Characters
            </p>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-indigo-500/50" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight uppercase leading-none">
            Hall of Champions
          </h1>
        </header>

        {/* Create New CTA */}
        <div
          className="w-full animate-slide-up"
          style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
        >
          <Link
            href="/characters/create"
            className="group relative w-full block overflow-hidden py-3.5 rounded-2xl font-display text-xl uppercase tracking-wider font-bold text-center transition-all cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer transition-all group-hover:brightness-110" />
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer opacity-40 blur-xl" />
            <span className="relative z-10 drop-shadow-lg flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create New Fighter
            </span>
          </Link>
        </div>

        {/* Character Grid */}
        <div
          className="w-full animate-slide-up"
          style={{ animationDelay: "0.2s", animationFillMode: "backwards" }}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm text-gray-500 tracking-wide">
                Loading fighters&hellip;
              </p>
            </div>
          ) : characters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <svg
                className="w-12 h-12 text-gray-700"
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
                No fighters yet. Create your first to start battling!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {characters.map((c, i) => (
                <Link key={c.id} href={`/characters/${c.id}/edit`}>
                  <div
                    className="group relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.03] hover:ring-1 hover:ring-white/20 animate-slide-up"
                    style={{
                      animationDelay: `${0.25 + i * 0.05}s`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <div className="aspect-square bg-gray-800 overflow-hidden">
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                    {/* Delete button — top right, visible on hover */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(c.id);
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40 hover:border-red-500/30 cursor-pointer"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-gray-300"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>

                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-sm font-semibold text-white/90 leading-tight truncate">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-white/50 truncate mt-0.5">
                        {c.textPrompt}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
