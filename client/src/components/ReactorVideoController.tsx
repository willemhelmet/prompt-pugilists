import { useEffect, useRef } from "react";
import { useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import type { Battle, BattleResolution } from "../types";

const CYCLE_RESTART_THRESHOLD = 230;

// Style lock — must match the suffix the AI engine appends to every videoPrompt.
// Reactor has no memory between prompts, so every prompt needs identical style cues
// to prevent the visual aesthetic from shifting between rounds.
const STYLE_SUFFIX =
  "AAA video game, Unreal Engine 5, global illumination, volumetric lighting, stylized 3D characters, vibrant saturated colors, dramatic rim lighting, shallow depth of field, cinematic camera.";

interface ReactorVideoControllerProps {
  battle: Battle | null;
  environment: string | null;
  lastResolution: BattleResolution | null;
  winner: string | null;
}

// ── Prompt composers ────────────────────────────────────────────

function composeArenaPrompt(environment: string): string {
  return `${environment}. Empty arena, dramatic atmosphere, camera slowly panning across the battlefield, anticipation building. ${STYLE_SUFFIX}`;
}

function composeInitialPrompt(battle: Battle): string {
  const c1 = battle.player1.character;
  const c2 = battle.player2.character;
  const env = battle.currentState.environmentDescription;
  const c1Desc = c1.visualFingerprint || c1.textPrompt;
  const c2Desc = c2.visualFingerprint || c2.textPrompt;
  return `${c1Desc} and ${c2Desc} face off in ${env}. Dramatic fighting game scene, medium-wide shot, slightly low angle. ${STYLE_SUFFIX}`;
}

function composeAmbientPrompt(battle: Battle): string {
  const c1 = battle.player1.character;
  const c2 = battle.player2.character;
  const env = battle.currentState.environmentDescription;
  return `${c1.name} and ${c2.name} circle each other in ${env}. Tense standoff, medium-wide shot, both fighters visible. ${STYLE_SUFFIX}`;
}

function composeVictoryPrompt(battle: Battle, winnerId: string): string {
  const isP1Winner = battle.player1.playerId === winnerId;
  const winnerChar = isP1Winner ? battle.player1.character : battle.player2.character;
  const loserChar = isP1Winner ? battle.player2.character : battle.player1.character;
  const winnerDesc = winnerChar.visualFingerprint || winnerChar.textPrompt;
  const loserDesc = loserChar.visualFingerprint || loserChar.textPrompt;
  const env = battle.currentState.environmentDescription;

  return `${winnerDesc} strikes a triumphant victory pose, fist raised to the sky, surrounded by brilliant golden fireworks exploding across the sky, colorful confetti raining down, and radiant celebration light beams. Behind them, ${loserDesc} lies defeated on the ground. The arena (${env}) is bathed in celebratory golden light. Epic victory moment, medium-wide shot, low angle looking up at the champion. ${STYLE_SUFFIX}`;
}

// ── Helpers ─────────────────────────────────────────────────────

const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 500;

function isDataChannelError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Data channel not open");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Controller component ────────────────────────────────────────

export function ReactorVideoController({
  battle,
  environment,
  lastResolution,
  winner,
}: ReactorVideoControllerProps) {
  const { status, sendCommand } = useReactor((state) => ({
    status: state.status,
    sendCommand: state.sendCommand,
  }));

  const frameRef = useRef(0);
  const hasStartedRef = useRef(false);
  const battleStartedRef = useRef(false);
  const lastResolutionTimestampRef = useRef<string | null>(null);
  const winnerSentRef = useRef(false);

  useReactorMessage((message: { type?: string; data?: { current_frame?: number; current_prompt?: string | null; paused?: boolean; message?: string } }) => {
    if (message.type === "state" && message.data?.current_frame !== undefined) {
      frameRef.current = message.data.current_frame;
    } else if (message.type === "error") {
      console.error("[ReactorVideoController] SDK error message:", message.data?.message ?? message);
    }
  });

  // Retry a command if the data channel isn't open yet (SDK reports "ready"
  // before the WebRTC data channel finishes connecting).
  async function sendWithRetry(command: string, args: Record<string, unknown>): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await sendCommand(command, args);
        return;
      } catch (err) {
        if (isDataChannelError(err) && attempt < MAX_RETRIES) {
          console.log(`[ReactorVideoController] data channel not ready, retry ${attempt + 1}/${MAX_RETRIES}...`);
          await wait(RETRY_DELAY_MS);
        } else {
          throw err;
        }
      }
    }
  }

  // Send a prompt to the model. On first call, schedule at frame 0 and start.
  // On subsequent calls, schedule at currentFrame + 3 (per first-party example).
  async function schedulePrompt(prompt: string) {
    try {
      const timestamp = frameRef.current === 0 ? 0 : frameRef.current + 3;
      await sendWithRetry("schedule_prompt", {
        new_prompt: prompt,
        timestamp,
      });
      // Only send start on the very first prompt (when generation hasn't begun)
      if (frameRef.current === 0) {
        await sendWithRetry("start", {});
      }
    } catch (err) {
      console.error("[ReactorVideoController] command error:", err);
    }
  }

  // Reset and restart with a new prompt (for scene transitions like victory)
  async function resetAndStart(prompt: string) {
    try {
      await sendWithRetry("reset", {});
      frameRef.current = 0;
      await sendWithRetry("schedule_prompt", {
        new_prompt: prompt,
        timestamp: 0,
      });
      await sendWithRetry("start", {});
    } catch (err) {
      console.error("[ReactorVideoController] reset error:", err);
    }
  }

  // Phase 1: Arena prompt — when Reactor is ready and we have environment but no battle yet
  useEffect(() => {
    if (status !== "ready" || hasStartedRef.current || !environment || battle) return;

    const timer = setTimeout(() => {
      if (hasStartedRef.current) return;
      const prompt = composeArenaPrompt(environment);
      console.log("[ReactorVideoController] sending arena prompt");
      schedulePrompt(prompt).then(() => {
        hasStartedRef.current = true;
        console.log("[ReactorVideoController] arena prompt sent");
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [status, environment, battle]);

  // Phase 2: Battle start — when battle transitions to non-null
  useEffect(() => {
    if (!battle || battleStartedRef.current) return;
    if (status !== "ready") return;

    battleStartedRef.current = true;
    const prompt = composeInitialPrompt(battle);
    console.log("[ReactorVideoController] sending battle face-off prompt");

    // If video was already started from pre-battle, just schedule the new prompt
    if (hasStartedRef.current) {
      schedulePrompt(prompt);
    } else {
      // Shouldn't normally happen, but handle gracefully
      const timer = setTimeout(() => {
        schedulePrompt(prompt).then(() => {
          hasStartedRef.current = true;
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [battle, status]);

  // Phase 3: When a new resolution arrives, send its videoPrompt
  useEffect(() => {
    if (!battle || !lastResolution) return;
    if (lastResolution.timestamp === lastResolutionTimestampRef.current) return;
    if (status !== "ready") return;

    lastResolutionTimestampRef.current = lastResolution.timestamp;
    schedulePrompt(lastResolution.videoPrompt);
  }, [lastResolution, status, battle]);

  // Phase 4: When winner is declared, reset and send victory prompt
  useEffect(() => {
    if (!battle || !winner || winnerSentRef.current) return;
    if (status !== "ready") return;

    winnerSentRef.current = true;
    const prompt = composeVictoryPrompt(battle, winner);
    resetAndStart(prompt);
  }, [winner, status, battle]);

  // Ambient loop: restart when approaching frame limit.
  // Keep running during resolution so the video doesn't go black while Mistral processes.
  useEffect(() => {
    if (status !== "ready" || winner) return;

    const interval = setInterval(() => {
      if (frameRef.current >= CYCLE_RESTART_THRESHOLD) {
        let prompt: string;
        if (battle) {
          prompt = composeAmbientPrompt(battle);
        } else if (environment) {
          prompt = composeArenaPrompt(environment);
        } else {
          return;
        }
        resetAndStart(prompt);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, winner, battle, environment]);

  return null;
}
