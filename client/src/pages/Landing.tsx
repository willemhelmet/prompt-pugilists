import { Link } from "wouter";

export function Landing() {
  return (
    <div className="relative flex flex-col items-center min-h-screen p-6 overflow-hidden">
      {/* Background video — full width, edge to edge */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src="/whp-web.webm"
      />
      {/* Dark overlay to dim the video */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Spacer to push buttons to bottom */}
      <div className="flex-1" />

      {/* Buttons pinned to bottom */}
      <div className="relative z-10 flex gap-3 w-full max-w-lg pb-4">
        <Link
          href="/host/environment"
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-center py-3 px-4 rounded-lg font-semibold transition-colors"
        >
          Host Game
        </Link>
        <Link
          href="/join"
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-center py-3 px-4 rounded-lg font-semibold transition-colors border border-gray-700"
        >
          Join Game
        </Link>
        <Link
          href="/characters"
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-center py-3 px-4 rounded-lg font-semibold transition-colors border border-gray-700"
        >
          Characters
        </Link>
      </div>
    </div>
  );
}
