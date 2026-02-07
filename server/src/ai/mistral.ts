import { Mistral } from "@mistralai/mistralai";
import type { Battle, BattleResolution } from "../types.js";
import { placeholderResolve } from "../managers/BattleManager.js";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

// ── System prompt for combat adjudication ──────────────────────

const COMBAT_SYSTEM_PROMPT = `
You are the Dungeon Master for a high-stakes magical duel. Your role is to:

1. **Interpret** both players' actions creatively
2. **Evaluate** how they interact (do they clash? complement? counter?)
3. **Determine** outcomes using dramatic narrative and dice mechanics
4. **Update** HP and narrative state
5. **Create** a cinematic video prompt (2-3 sentences)

## Guidelines

**Action Resolution:**
- Both actions happen simultaneously - there is NO turn order
- Roll dice (1d20) to determine success vs failure
- Success threshold: 10+ (with modifiers based on creativity and context)
- Damage typically ranges from 8-15 HP per successful attack
- Get creative with how abilities interact (fire vs ice, shields vs projectiles, etc.)
- Players can attempt ANYTHING - interpret their intent generously
- Use the battle environment in creative ways
- No mana restrictions - players can cast unlimited spells!

**HP System:**
- Both players start with 20 HP
- Typical damage: 3-8 HP per attack
- Healing: 4-10 HP
- Critical moments can justify larger swings
- If HP reaches 0, that player is defeated

**Narrative State:**
- The battle environment should influence outcomes and descriptions
- Track character conditions dynamically (wounded, energized, exhausted, etc.)
- Build tension and drama
- Reference character appearance if relevant to actions

**Dice Rolls:**
- Roll for attack/defense/saves as needed
- Show your work (for transparency)
- Use modifiers based on action creativity and contextual advantages

**Video Prompt:**
- 2-3 cinematic sentences
- Describe the KEY visual moment of this exchange
- Focus on drama, action, and magical/combat effects
- Incorporate the battle environment
- Reference character appearance if relevant
- Example: "In the volcanic arena, Zara's fireball collides with Mordak's ice barrier above a river of lava. The elements clash in a blinding explosion of steam and light. When the mist clears, Mordak is on one knee at the edge of the lava flow, his shield shattered into glittering fragments."

**Announcer Text:**
- ONE short punchy sentence, max 15 words
- Hyped fight announcer style — exclamation marks, dramatic
- Example: "DEVASTATING fireball! Mordak crumbles to 8 HP!"

## Response Format

Return ONLY valid JSON:

{
  "interpretation": "Zara attempts a powerful fireball while Mordak conjures an ice shield",

  "player1HpChange": -5,
  "player2HpChange": -12,

  "newBattleState": {
    "environmentDescription": "The volcanic arena's lava flows are more intense, steam rising from the recent collision",
    "player1Condition": "Zara is breathing hard, sweat on her brow from the heat, but triumphant",
    "player2Condition": "Mordak kneels at the lava's edge, his shield shattered, left arm badly burned",
    "previousEvents": [
      "Zara cast massive fireball",
      "Mordak erected ice barrier",
      "Barrier shattered under overwhelming force",
      "Mordak took heavy damage and was knocked toward lava"
    ]
  },

  "videoPrompt": "A massive fireball erupts from Zara's hands and crashes into Mordak's shimmering ice barrier over rivers of flowing lava. The collision creates a blinding explosion of steam and crackling energy. When the mist clears, Mordak is on one knee at the edge of a lava flow, his shield shattered into glittering fragments, smoke rising from his scorched robes.",

  "announcerText": "DEVASTATING fireball! Mordak crumbles to 8 HP!",

  "diceRolls": [
    {
      "player": "player1",
      "purpose": "fireball attack",
      "formula": "1d20+3",
      "result": 18,
      "modifier": 3
    },
    {
      "player": "player1",
      "purpose": "fire damage",
      "formula": "2d8+3",
      "result": 14,
      "modifier": 3
    },
    {
      "player": "player2",
      "purpose": "ice shield defense",
      "formula": "1d20+1",
      "result": 12,
      "modifier": 1
    }
  ]
}
`;

// ── Build the per-round context prompt ─────────────────────────

function buildCombatPrompt(
  battle: Battle,
  action1: string,
  action2: string,
): string {
  const p1 = battle.player1;
  const p2 = battle.player2;
  const state = battle.currentState;

  return `
## Current Battle State

**Environment:** ${state.environmentDescription}

### Player 1: ${p1.character.name}
- HP: ${p1.currentHp}/${p1.maxHp}
- Appearance: ${p1.character.textPrompt}
- Condition: ${state.player1Condition}

### Player 2: ${p2.character.name}
- HP: ${p2.currentHp}/${p2.maxHp}
- Appearance: ${p2.character.textPrompt}
- Condition: ${state.player2Condition}

### Previous Events
${state.previousEvents.map((e, i) => `${i + 1}. ${e}`).join("\n")}

## This Round's Actions

**${p1.character.name} declares:** "${action1}"

**${p2.character.name} declares:** "${action2}"

---

Resolve these actions simultaneously and return your response as JSON.
`;
}

// ── Combat resolution (mistral-large) ──────────────────────────

export async function resolveCombat(
  battle: Battle,
  action1: string,
  action2: string,
): Promise<BattleResolution> {
  const prompt = buildCombatPrompt(battle, action1, action2);

  try {
    const response = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: COMBAT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      responseFormat: { type: "json_object" },
      temperature: 0.8,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("Empty response from Mistral");
    }

    const parsed = JSON.parse(content);

    const resolution: BattleResolution = {
      player1Action: action1,
      player2Action: action2,
      interpretation: parsed.interpretation,
      announcerText: parsed.announcerText || parsed.interpretation,
      player1HpChange: parsed.player1HpChange,
      player2HpChange: parsed.player2HpChange,
      newBattleState: parsed.newBattleState,
      videoPrompt: parsed.videoPrompt,
      diceRolls: parsed.diceRolls,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Mistral] Combat resolved via mistral-large — P1: ${resolution.player1HpChange} HP, P2: ${resolution.player2HpChange} HP`);
    return resolution;
  } catch (err) {
    console.error("[Mistral] Combat resolution FAILED, using placeholder:", err);
    return placeholderResolve(battle, action1, action2);
  }
}

// ── Action suggestion (mistral-medium) ─────────────────────────

export async function generateActionSuggestion(
  battle: Battle,
  playerId: string,
): Promise<string> {
  const player =
    battle.player1.playerId === playerId ? battle.player1 : battle.player2;
  const opponent =
    battle.player1.playerId === playerId ? battle.player2 : battle.player1;

  const isPlayer1 = battle.player1.playerId === playerId;

  const prompt = `
You are helping a player in a magical battle come up with a creative action.

## Battle Context
Environment: ${battle.currentState.environmentDescription}
Your Character: ${player.character.name} (${player.currentHp}/${player.maxHp} HP)
Your Condition: ${isPlayer1 ? battle.currentState.player1Condition : battle.currentState.player2Condition}
Opponent: ${opponent.character.name} (${opponent.currentHp}/${opponent.maxHp} HP)
Opponent Condition: ${isPlayer1 ? battle.currentState.player2Condition : battle.currentState.player1Condition}

## Previous Events
${battle.currentState.previousEvents.slice(-3).join("\n")}

## Task
Generate ONE creative action (2-3 sentences) that this player could take.
Be specific, dramatic, and use the environment.
Make it interesting and different from what they've done before.

Return ONLY the action text, no preamble.
`;

  try {
    const response = await client.chat.complete({
      model: "mistral-medium-latest",
      messages: [
        {
          role: "system",
          content: "You are a creative dungeon master assistant.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      maxTokens: 150,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("Empty response from Mistral");
    }

    console.log(`[Mistral] Action suggested via mistral-medium for ${player.character.name}`);
    return content.trim();
  } catch (err) {
    console.error("[Mistral] Action suggestion FAILED, using fallback:", err);
    return `${player.character.name} channels their energy and launches a powerful attack!`;
  }
}

// ── Surprise Me: character prompt ─────────────────────────────

export async function generateCharacterSuggestion(): Promise<{
  name: string;
  prompt: string;
}> {
  try {
    const response = await client.chat.complete({
      model: "mistral-medium-latest",
      messages: [
        {
          role: "system",
          content:
            "You are a creative fantasy character designer. Generate unique, visually striking fighters for a magical combat game.",
        },
        {
          role: "user",
          content: `Invent a unique fighting game character. Return ONLY valid JSON with two fields:
- "name": a dramatic character name (2-4 words)
- "prompt": a vivid visual description for AI image generation (60-100 words). Describe their appearance, clothing, weapons, magical effects, and mood. Use cinematic, visual language.

Be wildly creative — mix genres, cultures, and fantasy elements. No generic wizards or knights.`,
        },
      ],
      responseFormat: { type: "json_object" },
      temperature: 1.0,
      maxTokens: 200,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("Empty response");

    const parsed = JSON.parse(content);
    console.log(`[Mistral] Character suggestion: ${parsed.name}`);
    return { name: parsed.name, prompt: parsed.prompt };
  } catch (err) {
    console.error("[Mistral] Character suggestion FAILED:", err);
    return {
      name: "Ember Wraith",
      prompt:
        "A spectral warrior wreathed in flickering green flame, wearing tattered samurai armor fused with crystalline growths, dual-wielding curved blades that trail ghostly afterimages, hollow glowing eyes peering from beneath a cracked oni mask",
    };
  }
}

// ── Surprise Me: environment prompt ───────────────────────────

export async function generateEnvironmentSuggestion(): Promise<string> {
  try {
    const response = await client.chat.complete({
      model: "mistral-medium-latest",
      messages: [
        {
          role: "system",
          content:
            "You are a creative fantasy environment designer for a magical combat game.",
        },
        {
          role: "user",
          content: `Invent a unique battle arena for a fantasy fighting game. Return ONLY the description text (60-100 words, no JSON wrapping). Describe the landscape, lighting, atmosphere, and any dramatic environmental features. Use vivid, cinematic visual language. Be wildly creative — mix unexpected themes.`,
        },
      ],
      temperature: 1.0,
      maxTokens: 150,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("Empty response");

    console.log("[Mistral] Environment suggestion generated");
    return content.trim();
  } catch (err) {
    console.error("[Mistral] Environment suggestion FAILED:", err);
    return "A shattered clockwork cathedral suspended in a violet nebula, massive gears grinding slowly overhead, stained glass windows projecting kaleidoscopic light beams across floating stone platforms connected by chains of pure energy";
  }
}
