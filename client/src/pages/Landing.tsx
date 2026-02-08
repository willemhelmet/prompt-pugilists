import { Link } from "wouter";

export function Landing() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-8">
      <img src="/pp_logo.jpg" alt="Prompt Pugilists — AI Creative Combat" className="max-w-xs w-full" />

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/host/environment"
          className="bg-indigo-600 hover:bg-indigo-500 text-center py-3 px-6 rounded-lg font-semibold text-lg transition-colors"
        >
          Host Game
        </Link>

        <div className="text-center text-gray-500">or</div>

        <Link
          href="/join"
          className="bg-gray-800 hover:bg-gray-700 text-center py-3 px-6 rounded-lg font-semibold text-lg transition-colors border border-gray-700"
        >
          Join Game
        </Link>

        <Link
          href="/characters"
          className="bg-gray-800 hover:bg-gray-700 text-center py-3 px-6 rounded-lg font-semibold text-lg transition-colors border border-gray-700"
        >
          Browse Characters
        </Link>
      </div>
    </div>
  );
}
