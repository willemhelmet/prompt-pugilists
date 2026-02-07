import { useCallback, useEffect, useState } from "react";
import {
  ReactorProvider,
  ReactorView,
  useReactor,
  fetchInsecureJwtToken,
} from "@reactor-team/js-sdk";
import { ReactorVideoController } from "./ReactorVideoController";
import { VideoOverlay } from "./VideoOverlay";
import { TextOnlyBattleDisplay } from "./TextOnlyBattleDisplay";
import type { Battle, BattleResolution, SelectedCharacter } from "../types";

type ReactorState = "idle" | "loading" | "ready" | "error";

const MODEL_NAME = "livecore";

interface ReactorVideoSectionProps {
  battle: Battle | null;
  environment: string | null;
  selectedCharacters: SelectedCharacter[];
  lastResolution: BattleResolution | null;
  resolving: boolean;
  winner: string | null;
  roomId: string;
  onBackToMenu: () => void;
}

/**
 * Lives inside ReactorProvider — watches the SDK's own status and lastError
 * to detect connection failures. autoConnect={true} handles the actual connect().
 */
function ReactorStatusWatcher({ onError }: { onError: (msg: string) => void }) {
  const status = useReactor((state) => state.status);
  const lastError = useReactor((state) => state.lastError);

  // Log status transitions for debugging
  useEffect(() => {
    console.log("[ReactorStatusWatcher] status:", status);
  }, [status]);

  // React to SDK-reported errors
  useEffect(() => {
    if (lastError) {
      console.error("[ReactorStatusWatcher] SDK error:", lastError);
      onError(lastError.message || "Reactor connection error");
    }
  }, [lastError, onError]);

  return null;
}

export function ReactorVideoSection({
  battle,
  environment,
  selectedCharacters,
  lastResolution,
  resolving,
  winner,
  roomId,
  onBackToMenu,
}: ReactorVideoSectionProps) {
  const apiKey = import.meta.env.VITE_REACTOR_API_KEY;
  const [state, setState] = useState<ReactorState>("idle");
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Activate as soon as we have environment OR battle
  const shouldActivate = !!(battle || environment);

  // Fetch JWT when we should activate (and we have an API key)
  useEffect(() => {
    if (!shouldActivate || !apiKey) return;

    setState("loading");
    let cancelled = false;

    fetchInsecureJwtToken(apiKey)
      .then((token) => {
        if (!cancelled) {
          setJwtToken(token);
          setState("ready");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[ReactorVideoSection] JWT fetch failed:", err);
          setErrorMsg(err instanceof Error ? err.message : "Failed to authenticate with Reactor");
          setState("error");
        }
      });

    return () => { cancelled = true; };
  }, [shouldActivate, apiKey, retryCount]);

  function handleRetry() {
    setErrorMsg(null);
    setRetryCount((c) => c + 1);
  }

  // Called from inside ReactorProvider when the SDK's connection fails
  const handleConnectionError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setState("error");
  }, []);

  // No API key, or nothing to show yet — text-only display
  if (!apiKey || (!battle && !environment)) {
    return (
      <TextOnlyBattleDisplay
        battle={battle}
        lastResolution={lastResolution}
        resolving={resolving}
        winner={winner}
        roomId={roomId}
        onBackToMenu={onBackToMenu}
      />
    );
  }

  if (state === "idle" || state === "loading") {
    return (
      <div className="flex-1 bg-gray-900 rounded-xl flex items-center justify-center border border-gray-800 min-h-[300px]">
        <p className="text-gray-400 animate-pulse">Connecting to Reactor...</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex-1 bg-gray-900 rounded-xl flex flex-col items-center justify-center border border-gray-800 min-h-[300px] gap-4">
        <p className="text-red-400">Video connection failed</p>
        {errorMsg && <p className="text-gray-500 text-sm max-w-sm text-center">{errorMsg}</p>}
        <button
          onClick={handleRetry}
          className="bg-indigo-600 hover:bg-indigo-500 py-2 px-6 rounded-lg text-sm font-semibold transition-colors"
        >
          Retry
        </button>
        <TextOnlyBattleDisplay
          battle={battle}
          lastResolution={lastResolution}
          resolving={resolving}
          winner={winner}
          roomId={roomId}
          onBackToMenu={onBackToMenu}
        />
      </div>
    );
  }

  // state === "ready" — render Reactor video
  return (
    <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden border border-gray-800 min-h-[300px] relative">
      <ReactorProvider
        modelName={MODEL_NAME}
        jwtToken={jwtToken!}
        autoConnect={true}
      >
        <ReactorStatusWatcher onError={handleConnectionError} />
        <ReactorView
          className="w-full h-full"
          style={{ minHeight: "300px" }}
          videoObjectFit="cover"
        />
        <ReactorVideoController
          battle={battle}
          environment={environment}
          selectedCharacters={selectedCharacters}
          lastResolution={lastResolution}
          resolving={resolving}
          winner={winner}
        />
        {battle ? (
          <VideoOverlay
            battle={battle}
            resolving={resolving}
            winner={winner}
            onBackToMenu={onBackToMenu}
          />
        ) : (
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 z-10">
            <p className="text-gray-300 text-sm">
              {selectedCharacters.length === 0 ? "Awaiting challengers..."
               : selectedCharacters.length === 1 ? `${selectedCharacters[0].character.name} has entered. Waiting for opponent...`
               : "Both fighters ready. Battle starting soon..."}
            </p>
          </div>
        )}
      </ReactorProvider>
    </div>
  );
}
