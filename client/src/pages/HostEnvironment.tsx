import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { ENVIRONMENT_CHAR_LIMIT } from "../types";
import { socket, connectSocket } from "../lib/socket";
import { useGameStore } from "../stores/gameStore";
import { api } from "../lib/api";
import { resizeImage } from "../lib/resizeImage";
import { DEFAULT_ENVIRONMENTS } from "../lib/defaultEnvironments";

export function HostEnvironment() {
  const [environment, setEnvironment] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { setRoom, setIsHost } = useGameStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    connectSocket();

    function onRoomCreated({ roomId, room }: { roomId: string; room: any }) {
      setRoom(room);
      setIsHost(true);
      navigate(`/host/${roomId}`);
    }

    socket.on("room:created", onRoomCreated);

    return () => {
      socket.off("room:created", onRoomCreated);
    };
  }, [navigate, setRoom, setIsHost]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (referencePreview && referencePreview.startsWith("blob:")) {
        URL.revokeObjectURL(referencePreview);
      }
    };
  }, [referencePreview]);

  async function applyFile(file: File) {
    const resized = await resizeImage(file);
    setReferenceFile(resized);
    setReferencePreview(URL.createObjectURL(resized));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) applyFile(file);
  }

  function removeReference() {
    if (referencePreview && referencePreview.startsWith("blob:")) {
      URL.revokeObjectURL(referencePreview);
    }
    setReferenceFile(null);
    setReferencePreview(null);
  }

  async function handleGenerate() {
    if (!environment.trim() || generating) return;
    setGenerating(true);
    setError(null);

    try {
      let result: { url: string };
      if (referenceFile) {
        result = await api.generateCharacterImageWithReference(
          referenceFile,
          environment.trim(),
        );
      } else {
        result = await api.generateCharacterImage(environment.trim());
      }
      setImageUrl(result.url);
    } catch (err: any) {
      console.error("Arena generation failed:", err);
      setError(err.message || "Image generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSurpriseMe() {
    if (suggesting) return;
    setSuggesting(true);
    setError(null);

    try {
      const result = await api.suggestEnvironment();
      setEnvironment(result.prompt);
    } catch (err: any) {
      console.error("Suggestion failed:", err);
      setError(err.message || "Suggestion failed");
    } finally {
      setSuggesting(false);
    }
  }


  function selectPreset(preset: (typeof DEFAULT_ENVIRONMENTS)[number]) {
    setEnvironment(preset.description);
    setImageUrl(preset.imageUrl);
  }

  function handleContinue() {
    if (!environment.trim() || creating) return;
    setCreating(true);
    socket.emit("room:create", {
      username: "Host",
      environment: environment.trim(),
      environmentImageUrl: imageUrl || undefined,
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
              Battle Arena
            </p>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-indigo-500/50" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight uppercase leading-none">
            Set Your Arena
          </h1>
        </header>

        {/* ── Arena Preview ── */}
        <div
          className="w-full animate-slide-up"
          style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
        >
          <div className="arena-frame">
            <div className="relative w-full aspect-video bg-gray-900/90 rounded-2xl overflow-hidden">
              {generating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" />
                    <div className="absolute inset-0 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-sm text-gray-500 tracking-wide">
                    Forging arena&hellip;
                  </p>
                </div>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Battle arena"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8">
                  <svg
                    className="w-10 h-10 text-gray-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 20L7 10l4 5 3-4 8 9" />
                    <circle cx="18" cy="6" r="2" />
                  </svg>
                  <p className="text-gray-600 text-sm text-center leading-relaxed max-w-xs">
                    Describe your arena below or pick a preset to get started
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Description Panel ── */}
        <div
          className="w-full space-y-3 animate-slide-up"
          style={{ animationDelay: "0.2s", animationFillMode: "backwards" }}
        >
          <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <label className="text-[11px] tracking-[0.15em] uppercase text-gray-500 font-medium">
              Arena Description
            </label>

            <textarea
              value={environment}
              onChange={(e) =>
                setEnvironment(e.target.value.slice(0, ENVIRONMENT_CHAR_LIMIT))
              }
              className="w-full h-28 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 text-white text-sm leading-relaxed resize-none focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700"
              placeholder="A volcanic arena with rivers of molten lava, geysers of flame erupting from cracks..."
            />

            <p className="text-[11px] text-gray-600 text-right tabular-nums">
              {environment.length}/{ENVIRONMENT_CHAR_LIMIT}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-950/50 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm flex items-start gap-2.5">
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

          {/* Reference Image Upload */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="w-full border border-dashed border-white/[0.08] hover:border-white/[0.16] rounded-xl p-3.5 cursor-pointer transition-colors group"
          >
            {referencePreview ? (
              <div className="flex items-center gap-3">
                <img
                  src={referencePreview}
                  alt="Reference"
                  className="w-14 h-14 object-cover rounded-lg ring-1 ring-white/10"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Reference image set</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeReference();
                    }}
                    className="text-[11px] text-red-400/70 hover:text-red-300 mt-0.5 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-gray-600 group-hover:text-gray-500 transition-colors">
                <svg
                  className="w-5 h-5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <p className="text-xs">
                  Drop a reference image, or click to browse
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div
          className="w-full flex gap-3 animate-slide-up"
          style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}
        >
          <button
            onClick={handleSurpriseMe}
            disabled={suggesting}
            className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 disabled:bg-white/[0.02] disabled:text-gray-700 border border-purple-500/20 hover:border-purple-400/30 py-3 rounded-xl font-semibold text-sm text-purple-300 transition-all cursor-pointer disabled:cursor-default"
          >
            {suggesting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
                Thinking&hellip;
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <circle cx="9" cy="9" r="1" fill="currentColor" />
                  <circle cx="15" cy="9" r="1" fill="currentColor" />
                  <circle cx="9" cy="15" r="1" fill="currentColor" />
                  <circle cx="15" cy="15" r="1" fill="currentColor" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
                Surprise Me
              </span>
            )}
          </button>

          <button
            onClick={handleGenerate}
            disabled={!environment.trim() || generating}
            className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] disabled:bg-white/[0.02] disabled:text-gray-700 border border-white/[0.08] hover:border-white/[0.14] py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer disabled:cursor-default"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                Generating&hellip;
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" />
                </svg>
                Generate Arena
              </span>
            )}
          </button>
        </div>

        {/* ── Preset Arenas ── */}
        <div
          className="w-full animate-slide-up"
          style={{ animationDelay: "0.4s", animationFillMode: "backwards" }}
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            <p className="text-[11px] tracking-[0.25em] uppercase text-gray-500 font-medium">
              Preset Arenas
            </p>
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DEFAULT_ENVIRONMENTS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => selectPreset(preset)}
                className={`group relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
                  environment === preset.description
                    ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-950 scale-[0.97]"
                    : "hover:scale-[1.03] hover:ring-1 hover:ring-white/20"
                }`}
              >
                <div className="aspect-video bg-gray-800 overflow-hidden">
                  <img
                    src={preset.imageUrl}
                    alt={preset.label}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-[11px] sm:text-xs font-semibold text-white/90 leading-tight">
                    {preset.label}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── CTA: Enter the Arena ── */}
        <div
          className="w-full pt-2 animate-slide-up"
          style={{ animationDelay: "0.5s", animationFillMode: "backwards" }}
        >
          <button
            onClick={handleContinue}
            disabled={!environment.trim() || creating}
            className="group relative w-full overflow-hidden py-4 rounded-2xl font-display text-2xl uppercase tracking-wider font-bold transition-all disabled:opacity-25 disabled:cursor-default cursor-pointer"
          >
            {/* Animated gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer transition-all group-hover:brightness-110" />
            {/* Diffused glow underneath */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer opacity-40 blur-xl" />
            <span className="relative z-10 drop-shadow-lg">
              {creating ? "Creating Room\u2026" : "Enter the Arena"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
