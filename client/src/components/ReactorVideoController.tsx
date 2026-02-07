import { useEffect, useRef } from "react";
import { useReactor, useReactorMessage } from "@reactor-team/js-sdk";
import type { Battle, BattleResolution, SelectedCharacter } from "../types";

const CYCLE_RESTART_THRESHOLD = 230;

// Style lock — must match the suffix the AI engine appends to every videoPrompt.
// Reactor has no memory between prompts, so every prompt needs identical style cues
// to prevent the visual aesthetic from shifting between rounds.
const STYLE_SUFFIX =
  "AAA video game, Unreal Engine 5, global illumination, volumetric lighting, stylized 3D characters, vibrant saturated colors, dramatic rim lighting, shallow depth of field, cinematic camera.";

interface ReactorVideoControllerProps {
  battle: Battle | null;
  environment: string | null;
  selectedCharacters: SelectedCharacter[];
  lastResolution: BattleResolution | null;
  resolving: boolean;
  winner: string | null;
}

// ── Prompt composers ────────────────────────────────────────────

function composeArenaPrompt(environment: string): string {
  return `${environment}. Empty arena, dramatic atmosphere, camera slowly panning across the battlefield, anticipation building. ${STYLE_SUFFIX}`;
}

function composeCharacterEntrancePrompt(character: { visualFingerprint: string; textPrompt: string }, environment: string, isFirst: boolean): string {
  const desc = character.visualFingerprint || character.textPrompt;
  if (isFirst) {
    return `${desc} strides confidently into ${environment}, dramatic entrance, spotlight illuminating the first challenger. Medium shot, low angle. ${STYLE_SUFFIX}`;
  }
  return `${desc} makes a dramatic entrance into ${environment}, facing their opponent across the arena, tension building. Medium-wide shot, dynamic angle. ${STYLE_SUFFIX}`;
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

// ── Controller component ────────────────────────────────────────

export function ReactorVideoController({
  battle,
  environment,
  selectedCharacters,
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
  const charCountRef = useRef(0);
  const battleStartedRef = useRef(false);
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

  // Phase 2: Character entrance — when a new character is selected pre-battle
  useEffect(() => {
    if (status !== "ready" || !hasStartedRef.current || !environment || battle) return;
    if (selectedCharacters.length <= charCountRef.current) return;

    const newChar = selectedCharacters[selectedCharacters.length - 1];
    charCountRef.current = selectedCharacters.length;
    const isFirst = selectedCharacters.length === 1;
    const prompt = composeCharacterEntrancePrompt(newChar.character, environment, isFirst);
    console.log("[ReactorVideoController] sending entrance prompt for", newChar.character.name);
    schedulePrompt(prompt);
  }, [status, selectedCharacters, environment, battle]);

  // Phase 3: Battle start — when battle transitions to non-null
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

  // Phase 4: When a new resolution arrives, send its videoPrompt
  useEffect(() => {
    if (!battle || !lastResolution) return;
    if (lastResolution.timestamp === lastResolutionTimestampRef.current) return;
    if (status !== "ready") return;

    lastResolutionTimestampRef.current = lastResolution.timestamp;
    schedulePrompt(lastResolution.videoPrompt);
  }, [lastResolution, status, battle]);

  // Phase 5: When winner is declared, reset and send victory prompt
  useEffect(() => {
    if (!battle || !winner || winnerSentRef.current) return;
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
        let prompt: string;
        if (battle) {
          prompt = composeAmbientPrompt(battle);
        } else if (environment) {
          // Pre-battle ambient: cycle based on what's available
          if (selectedCharacters.length > 0) {
            const lastChar = selectedCharacters[selectedCharacters.length - 1];
            prompt = composeCharacterEntrancePrompt(lastChar.character, environment, selectedCharacters.length === 1);
          } else {
            prompt = composeArenaPrompt(environment);
          }
        } else {
          return;
        }
        resetAndStart(prompt);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, winner, resolving, battle, environment, selectedCharacters]);

  return null;
}
