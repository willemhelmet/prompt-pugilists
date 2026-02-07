import { nanoid } from "nanoid";
import type {
  Battle,
  BattleResolution,
  BattleState,
  Character,
} from "../types.js";
import { MAX_HP } from "../types.js";

export function createBattle(
  roomId: string,
  player1Character: Character,
  player2Character: Character,
  player1Id: string,
  player2Id: string,
  environment: string,
): Battle {
  const initialState: BattleState = {
    environmentDescription: environment,
    player1Condition: `${player1Character.name} stands ready for battle`,
    player2Condition: `${player2Character.name} stands ready for battle`,
    previousEvents: [],
  };

  return {
    id: nanoid(),
    roomId,
    player1: {
      playerId: player1Id,
      character: player1Character,
      currentHp: MAX_HP,
      maxHp: MAX_HP,
    },
    player2: {
      playerId: player2Id,
      character: player2Character,
      currentHp: MAX_HP,
      maxHp: MAX_HP,
    },
    currentState: initialState,
    pendingActions: { player1: null, player2: null },
    resolutionHistory: [],
    winnerId: null,
    winCondition: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function applyResolution(battle: Battle, resolution: BattleResolution): void {
  battle.player1.currentHp = Math.max(
    0,
    Math.min(battle.player1.currentHp + resolution.player1HpChange, battle.player1.maxHp),
  );
  battle.player2.currentHp = Math.max(
    0,
    Math.min(battle.player2.currentHp + resolution.player2HpChange, battle.player2.maxHp),
  );

  battle.currentState = resolution.newBattleState;
  battle.resolutionHistory.push(resolution);
}

export function checkVictory(battle: Battle): string | null {
  if (battle.player1.currentHp <= 0) return battle.player2.playerId;
  if (battle.player2.currentHp <= 0) return battle.player1.playerId;
  return null;
}

// Placeholder resolution used as fallback when Mistral API fails
function rollDice(formula: string): { result: number; modifier: number } {
  // Parse "1d20+3" style formulas
  const match = formula.match(/(\d+)d(\d+)(?:\+(\d+))?/);
  if (!match) return { result: 10, modifier: 0 };
  const [, count, sides, mod] = match;
  let total = 0;
  for (let i = 0; i < parseInt(count); i++) {
    total += Math.floor(Math.random() * parseInt(sides)) + 1;
  }
  const modifier = parseInt(mod || "0");
  return { result: total + modifier, modifier };
}

export function placeholderResolve(
  battle: Battle,
  action1: string,
  action2: string,
): BattleResolution {
  const p1 = battle.player1;
  const p2 = battle.player2;

  const p1Attack = rollDice("1d20+3");
  const p1Damage = rollDice("2d6+2");
  const p2Attack = rollDice("1d20+3");
  const p2Damage = rollDice("2d6+2");

  const p1Hit = p1Attack.result >= 10;
  const p2Hit = p2Attack.result >= 10;

  const p1HpChange = p2Hit ? -p2Damage.result : 0;
  const p2HpChange = p1Hit ? -p1Damage.result : 0;

  const events: string[] = [];
  if (p1Hit) events.push(`${p1.character.name}'s attack landed for ${-p2HpChange} damage`);
  else events.push(`${p1.character.name}'s attack missed`);
  if (p2Hit) events.push(`${p2.character.name}'s attack landed for ${-p1HpChange} damage`);
  else events.push(`${p2.character.name}'s attack missed`);

  return {
    player1Action: action1,
    player2Action: action2,
    interpretation: `${p1.character.name} attempts: "${action1.slice(0, 60)}..." while ${p2.character.name} attempts: "${action2.slice(0, 60)}..."`,
    player1HpChange: p1HpChange,
    player2HpChange: p2HpChange,
    newBattleState: {
      environmentDescription: battle.currentState.environmentDescription,
      player1Condition: p1Hit
        ? `${p1.character.name} strikes true`
        : `${p1.character.name}'s attack goes wide`,
      player2Condition: p2Hit
        ? `${p2.character.name} strikes true`
        : `${p2.character.name}'s attack goes wide`,
      previousEvents: [
        ...battle.currentState.previousEvents.slice(-4),
        ...events,
      ],
    },
    videoPrompt: `${p1.character.name} and ${p2.character.name} clash in ${battle.currentState.environmentDescription}`,
    announcerText: `${p1.character.name} and ${p2.character.name} clash in an explosive exchange!`,
    diceRolls: [
      { player: "player1", purpose: "attack roll", formula: "1d20+3", result: p1Attack.result, modifier: p1Attack.modifier },
      ...(p1Hit ? [{ player: "player1" as const, purpose: "damage", formula: "2d6+2", result: p1Damage.result, modifier: p1Damage.modifier }] : []),
      { player: "player2", purpose: "attack roll", formula: "1d20+3", result: p2Attack.result, modifier: p2Attack.modifier },
      ...(p2Hit ? [{ player: "player2" as const, purpose: "damage", formula: "2d6+2", result: p2Damage.result, modifier: p2Damage.modifier }] : []),
    ],
    timestamp: new Date().toISOString(),
  };
}
