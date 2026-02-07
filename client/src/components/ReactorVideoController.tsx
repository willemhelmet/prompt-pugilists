import { useEffect, useRef } from "react";
import { useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import type { Battle, BattleResolution } from "../types";

const FRAME_LIMIT = 240;
const CYCLE_RESTART_THRESHOLD = 230;

interface ReactorVideoControllerProps {
  battle: Battle;
  lastResolution: BattleResolution | null;
  resolving: boolean;
  winner: string | null;
}

function composeInitialPrompt(battle: Battle): string {
  const c1 = battle.player1.character;
  const c2 = battle.player2.character;
  const env = battle.currentState.environmentDescription;
  return `${c1.textPrompt} and ${c2.textPrompt} face off in ${env}. Dramatic fighting game scene, dynamic camera angle, vibrant colors.`;
}

function composeAmbientPrompt(battle: Battle): string {
  const c1 = battle.player1.character;
  const c2 = battle.player2.character;
  const env = battle.currentState.environmentDescription;
  return `${c1.name} and ${c2.name} circle each other in ${env}. Tense standoff, fighting game, dynamic lighting.`;
}

function composeVictoryPrompt(battle: Battle, winnerId: string): string {
  const isP1Winner = battle.player1.playerId === winnerId;
  const winnerChar = isP1Winner ? battle.player1.character : battle.player2.character;
  const loser = isP1Winner ? battle.player2.character : battle.player1.character;
  return `${winnerChar.name} stands victorious over ${loser.name}. Triumphant pose, dramatic lighting, fighting game victory screen.`;
}

export function ReactorVideoController({
  battle,
  lastResolution,
  resolving,
  winner,
}: ReactorVideoControllerProps) {
  const { status, sendCommand } = useReactor((state) => ({
    status: state.status,
    sendCommand: state.sendCommand,
  }));

  const frameRef = useRef(0);
  const hasStartedRef = useRef(false);
  const lastResolutionTimestampRef = useRef<string | null>(null);
  const winnerSentRef = useRef(false);

  useReactorMessage((message: { type?: string; data?: { current_frame?: number; current_prompt?: string | null; paused?: boolean } }) => {
    if (message.type === "state" && message.data?.current_frame !== undefined) {
      frameRef.current = message.data.current_frame;
    }
  });

  // Send a prompt to the model. On first call, schedule at frame 0 and start.
  // On subsequent calls, schedule at currentFrame + 3 (per first-party example).
  async function schedulePrompt(prompt: string) {
    try {
      const timestamp = frameRef.current === 0 ? 0 : frameRef.current + 3;
      await sendCommand("schedule_prompt", {
        new_prompt: prompt,
        timestamp,
      });
      // Only send start on the very first prompt (when generation hasn't begun)
      if (frameRef.current === 0) {
        await sendCommand("start", {});
      }
    } catch (err) {
      console.error("[ReactorVideoController] command error:", err);
    }
  }

  // Reset and restart with a new prompt (for scene transitions like victory)
  async function resetAndStart(prompt: string) {
    try {
      await sendCommand("reset", {});
      frameRef.current = 0;
      await sendCommand("schedule_prompt", {
        new_prompt: prompt,
        timestamp: 0,
      });
      await sendCommand("start", {});
    } catch (err) {
      console.error("[ReactorVideoController] reset error:", err);
    }
  }

  // Initial prompt when battle starts and Reactor is ready.
  // Small delay lets the data channel fully open after status hits "ready".
  useEffect(() => {
    if (status !== "ready" || hasStartedRef.current) return;

    const timer = setTimeout(() => {
      if (hasStartedRef.current) return;
      const prompt = composeInitialPrompt(battle);
      console.log("[ReactorVideoController] sending initial prompt");
      schedulePrompt(prompt).then(() => {
        hasStartedRef.current = true;
        console.log("[ReactorVideoController] initial prompt sent");
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [status, battle]);

  // When a new resolution arrives, send its videoPrompt
  useEffect(() => {
    if (!lastResolution) return;
    if (lastResolution.timestamp === lastResolutionTimestampRef.current) return;
    if (status !== "ready") return;

    lastResolutionTimestampRef.current = lastResolution.timestamp;
    schedulePrompt(lastResolution.videoPrompt);
  }, [lastResolution, status]);

  // When winner is declared, reset and send victory prompt
  useEffect(() => {
    if (!winner || winnerSentRef.current) return;
    if (status !== "ready") return;

    winnerSentRef.current = true;
    const prompt = composeVictoryPrompt(battle, winner);
    resetAndStart(prompt);
  }, [winner, status, battle]);

  // Ambient loop: restart when approaching frame limit
  useEffect(() => {
    if (status !== "ready" || winner || resolving) return;

    const interval = setInterval(() => {
      if (frameRef.current >= CYCLE_RESTART_THRESHOLD) {
        const prompt = composeAmbientPrompt(battle);
        resetAndStart(prompt);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, winner, resolving, battle]);

  return null;
}
