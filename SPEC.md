# Prompt Pugilists - Technical Specification v3.2

**Working Title:** Prompt Pugilists  
**Last Updated:** February 6, 2026  
**Status:** Hackathon Project

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Philosophy](#design-philosophy)
3. [System Architecture](#system-architecture)
4. [Data Models](#data-models)
5. [Client Architecture](#client-architecture)
6. [Server Architecture](#server-architecture)
7. [Combat Resolution](#combat-resolution)
8. [API Specifications](#api-specifications)
9. [Database Schema](#database-schema)
10. [Example Battle Flow](#example-battle-flow)
11. [Character System](#character-system)
12. [Development Roadmap](#development-roadmap)
13. [Technical Requirements](#technical-requirements)
14. [Cost Estimates](#cost-estimates)

---

## Executive Summary

**Prompt Pugilists** is a multiplayer real-time fighting game where players create custom characters and battle using natural language prompts. The game adopts a **Jackbox-style local multiplayer** model where a host device (laptop/desktop) displays AI-generated battle videos, while players control their characters through mobile devices.

### Core Gameplay Loop

1. **Host Setup**: Host device creates a room, selects battle environment, and displays a 6-character room code
2. **Player Join**: 2 players join via mobile devices using the room code
3. **Character Selection**: Players select from their created characters (AI-generated images)
4. **Battle**: Players submit natural language action prompts simultaneously
5. **AI Resolution**: Server uses ChatGPT to adjudicate actions and generate battle narrative
6. **Video Generation**: Reactor LiveCore creates real-time video of the battle scene
7. **Repeat**: Battle continues until one player's HP reaches 0

### Key Innovation

**Natural Language Combat**: Instead of rigid spell/action menus, players describe what they want to do in plain English. The AI interprets intent, resolves outcomes using dice rolls, and generates cinematic video prompts.

**AI Character Generation**: Characters are created using Decart's AI image generation, allowing players to describe their fighter or upload reference images.

---

## Design Philosophy

### Creative Freedom Over Structure

- **No Rigid Types**: Damage types, spell effects, and abilities are freeform strings, not enums
- **AI Interpretation**: ChatGPT interprets player intent through natural language alone
- **Minimal Constraints**: Players can attempt anything; success depends on stats and dice rolls
- **Single Decisive Round**: No complex multi-round state tracking; focus on dramatic moment-to-moment combat

### Guiding Principles

1. **Player Agency**: "I want to..." should always be valid input
2. **Emergent Gameplay**: Interesting interactions emerge from AI interpretation
3. **Accessibility**: No need to memorize spell lists or game mechanics
4. **Spectacle**: Every round generates a unique, cinematic video moment

---

## System Architecture

### High-Level Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Host      │ ◄─────► │    Server    │ ◄─────► │  Reactor    │
│  (Desktop)  │  WSS    │   (Node.js)  │  WSS    │  LiveCore   │
│  Video Out  │         │              │         └─────────────┘
└─────────────┘         └──────────────┘
                              ▲                   ┌─────────────┐
                              │                   │  ChatGPT    │
                              │            HTTP   │    API      │
                              │         ◄────────►└─────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐       ┌─────▼─────┐
              │  Player 1 │       │  Player 2 │
              │  (Mobile) │       │  (Mobile) │
              └───────────┘       └───────────┘
```

### Why This Architecture?

**Reactor Limitation**: Reactor LiveCore only supports a single video stream per session. This necessitates a local multiplayer model where:

- One device acts as the "host" and displays the shared video stream
- Player devices control their characters but don't render video
- Similar to Jackbox Games party game model

### Technology Stack

#### Host Client (Desktop/Laptop)

- **Framework**: React with TypeScript
- **WebRTC**: Reactor JS SDK for video streaming
- **State**: Zustand for simple state management
- **WebSocket**: Native WebSocket or Socket.io client
- **UI**: Minimal - primarily video display + scoreboard

#### Player Client (Mobile)

- **Framework**: React with TypeScript (responsive mobile UI)
- **State**: Zustand
- **WebSocket**: Socket.io client for real-time communication
- **UI**: Tailwind CSS for mobile-optimized interface

#### Server

- **Runtime**: Node.js with TypeScript
- **WebSocket**: Socket.io (for room management)
- **HTTP**: Express for REST endpoints
- **State**: In-memory only (hackathon simplicity)
- **AI Integration**:
  - OpenAI SDK (ChatGPT API for combat adjudication)
  - Reactor SDK (LiveCore video generation)
  - Decart API (AI image generation for characters)

#### Database

- **Database**: SQLite (via `better-sqlite3`)
- **Rationale**:
  - Zero configuration, file-based
  - Perfect for hackathon/local deployment
  - No external dependencies
  - Easy backup (just copy `game.db`)

#### AI Services

- **ChatGPT API**: GPT-4-turbo for combat resolution
- **Reactor LiveCore**: Real-time video generation
- **Decart**: AI image generation for characters (hackathon sponsor)

---

## Data Models

### Character Schema

```typescript
interface Character {
  id: string;
  userId: string;
  name: string;

  // Single character image (generated by Decart)
  imageUrl: string;

  // Inputs used for generation (can be updated and regenerated)
  textPrompt: string; // "A fire mage with red robes and glowing hands"
  referenceImageUrl: string | null; // Optional uploaded image for reference

  createdAt: Date;
  updatedAt: Date;
}
```

**Design Philosophy**: Characters are a **single AI-generated image** created via Decart. Players can:

- Write a text description
- Upload a reference image (optional)
- Combine both
- Regenerate at any time to get different variations

All characters have the same HP (50). Combat is entirely based on player creativity and AI interpretation.

### Room Schema

```typescript
interface Room {
  id: string; // 6-char alphanumeric code (e.g., "A3K9ZX")
  hostConnectionId: string;

  players: {
    player1: PlayerConnection | null;
    player2: PlayerConnection | null;
  };

  state:
    | "waiting"
    | "environment_select"
    | "character_select"
    | "battle"
    | "completed";

  // Battle environment (set by host)
  environment: string | null; // "A volcanic arena with lava flows" or "An ancient library filled with mystical tomes"

  battle: Battle | null;

  createdAt: Date;
  expiresAt: Date; // Auto-cleanup after 2 hours
}

interface PlayerConnection {
  connectionId: string;
  playerId: string; // User ID or session ID
  username: string;
  characterId: string | null;
  ready: boolean;
}
```

### Battle Schema

```typescript
interface Battle {
  id: string;
  roomId: string;

  player1: BattlePlayer;
  player2: BattlePlayer;

  // Current state
  currentState: BattleState;

  // Action tracking
  pendingActions: {
    player1: PendingAction | null;
    player2: PendingAction | null;
  };

  // Resolution history (for debugging/replay)
  resolutionHistory: BattleResolution[];

  // Victory
  winnerId: string | null;
  winCondition: "hp_depleted" | "forfeit" | null;

  createdAt: Date;
  completedAt: Date | null;
}
```

#### Battle Player

```typescript
interface BattlePlayer {
  playerId: string;
  character: Character;

  // Fixed HP for all characters
  currentHp: number; // Starts at 50
  maxHp: number; // Always 50
}
```

#### Battle State (Narrative-Driven)

```typescript
interface BattleState {
  // Freeform narrative state of the battle
  environmentDescription: string;
  // Example: "The arena is filled with smoke and crackling energy"

  player1Condition: string;
  // Example: "Zara is breathing heavily, her robes singed"

  player2Condition: string;
  // Example: "Mordak's shield shimmers, but he's wounded"

  // History of what's happened (cumulative narrative)
  previousEvents: string[];
  // Example: ["Zara cast a fireball", "Mordak deflected with ice shield", ...]
}
```

#### Pending Action

```typescript
interface PendingAction {
  actionText: string; // Pure natural language
  submittedAt: Date;
  // No actionType, targetSpellId, etc. - AI interprets everything
}
```

#### Battle Resolution

```typescript
interface BattleResolution {
  // Player actions submitted
  player1Action: string;
  player2Action: string;

  // AI interpretation & results
  interpretation: string; // What the AI understood the players wanted

  // State changes (simple)
  player1HpChange: number; // negative = damage, positive = heal
  player2HpChange: number;

  // Updated world state
  newBattleState: BattleState;

  // Narrative for video
  videoPrompt: string; // The prompt sent to Reactor

  // Dice rolls (for transparency/drama)
  diceRolls: DiceRoll[];

  timestamp: Date;
}
```

#### Dice Roll

```typescript
interface DiceRoll {
  player: "player1" | "player2";
  purpose: string; // Freeform: "attack roll", "dodge check", "willpower save"
  formula: string; // "1d20+5", "3d6+3"
  result: number;
  modifier: number;
}
```

---

## Client Architecture

### 3 Client Types

#### 1. Host Client (Desktop - Video Display)

**URL**: `/host/:roomId`

```
┌─────────────────────────────────────────────────┐
│  Room Code: A3K9ZX             Round: 3         │
├────────────────┬────────────────────────────────┤
│  Zara          │          Mordak                │
│  HP: 35/50 ▓▓▓▓▓▓▓░░░                           │
│                │          HP: 28/50 ▓▓▓▓▓░░░░░ │
├────────────────┴────────────────────────────────┤
│                                                  │
│        [Reactor Video Feed - 1280x720]          │
│                                                  │
│                                                  │
├──────────────────────────────────────────────────┤
│  Last Round:                                     │
│  Zara's lightning bolt struck Mordak for 12 dmg!│
│  Mordak's ice shield absorbed 5 damage.         │
│                                                  │
│  Waiting for players to submit actions...       │
└──────────────────────────────────────────────────┘
```

**Features**:

- Display Reactor video stream
- Show player HP/status
- Display round history
- Minimal interaction (just watches)
- Room code prominently displayed

#### 2. Player Client (Mobile - Control)

**URL**: `/play/:roomId`

```
┌─────────────────────────────────────┐
│  You: Zara the Pyromancer           │
│  HP: 35/50  ▓▓▓▓▓▓▓░░░             │
├─────────────────────────────────────┤
│  Your Turn - Round 3                │
│                                     │
│  Describe your action:              │
│  ┌───────────────────────────────┐ │
│  │ I channel all my remaining    │ │
│  │ power into a desperate final  │ │
│  │ inferno, summoning ancient    │ │
│  │ fire spirits to overwhelm     │ │
│  │ their defenses completely!    │ │
│  │                               │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│  Characters: 123/500               │
│                                     │
│  💡 Tip: Be specific and creative!  │
│                                     │
│  [✨ Generate Action for Me]        │
│  [Submit Action] ← Waiting...       │
└─────────────────────────────────────┘
```

**Features**:

- **Large text input** (500 char limit)
- **Character counter** showing remaining characters
- **"Generate Action" button**: Uses AI to suggest an action based on current battle state
- **HP display only** (no mana - unlimited spells!)
- **Opponent ready indicator**
- **Tips/hints** for effective prompting

#### 3. Landing Page

**URL**: `/`

```
┌─────────────────────────────────────┐
│  MAGE BATTLE                        │
│                                     │
│  [Host Game]                        │
│                                     │
│  OR                                 │
│                                     │
│  Enter Room Code:                   │
│  ┌─────┐                            │
│  │     │  [Join Game]               │
│  └─────┘                            │
│                                     │
│  [My Characters]                    │
└─────────────────────────────────────┘
```

#### 4. Host Environment Selection (`/host/environment`)

**URL**: `/host/environment` (after creating room)

```
┌─────────────────────────────────────┐
│  ⬅ Back       Set Battle Arena      │
├─────────────────────────────────────┤
│  Describe the battle environment:   │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ A volcanic arena with rivers  │ │
│  │ of molten lava crisscrossing  │ │
│  │ the obsidian floor           │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│  Characters: 89/300                 │
│                                     │
│  Or choose a preset:                │
│  [🌋 Volcanic Arena]                │
│  [🏛️ Ancient Temple]                │
│  [🌲 Enchanted Forest]              │
│  [🏰 Ruined Castle]                 │
│  [⚡ Storm Peak]                    │
│  [🌊 Floating Islands]              │
│                                     │
│  [Continue to Room Code]            │
└─────────────────────────────────────┘
```

**Features**:

- **Freeform text input** for custom environments (300 char limit)
- **Preset options** for quick selection
- Environment is used as context for all battle descriptions

### Character Management UI

#### Gallery View (`/characters`)

```
┌─────────────────────────────────────┐
│  ⬅ Back         My Characters       │
├─────────────────────────────────────┤
│  [+ Create New Character]           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │ [IMG]   │  │ [IMG]   │          │
│  │ Zara    │  │ Mordak  │          │
│  │ Fire    │  │ Ice     │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │ [IMG]   │  │ [IMG]   │          │
│  │ Luna    │  │ Gorath  │          │
│  │ Healing │  │ Necro   │          │
│  └─────────┘  └─────────┘          │
│                                     │
├─────────────────────────────────────┤
│  [Browse Marketplace] 🔒 Coming Soon│
└─────────────────────────────────────┘
```

#### Character Creation (`/characters/create`)

```
┌─────────────────────────────────────┐
│  ⬅ Cancel      Create Character     │
├─────────────────────────────────────┤
│  Character Name:                    │
│  ┌───────────────────────────────┐ │
│  │ Zara the Pyromancer           │ │
│  └───────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│  Character Preview                  │
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │     [Character Image]         │ │
│  │      (512x512)                │ │
│  │                               │ │
│  │  [Generated by Decart AI]     │ │
│  └───────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│  Describe your character:           │
│  ┌───────────────────────────────┐ │
│  │ A fierce fire mage wearing    │ │
│  │ crimson robes with glowing    │ │
│  │ embers swirling around her    │ │
│  │ hands                         │ │
│  └───────────────────────────────┘ │
│  Characters: 87/500                 │
│                                     │
│  Reference Image (optional):        │
│  [📎 Upload Image] or drag here     │
│  [No image uploaded]                │
│                                     │
│  💡 Combine text + image for best   │
│  results!                           │
│                                     │
│  [🔄 Regenerate Character]          │
│                                     │
├─────────────────────────────────────┤
│  [Save Character]                   │
└─────────────────────────────────────┘
```

**Character Creation Features:**

- **Name input**: Character's display name
- **Single character image**: Generated by Decart AI
- **Text prompt**: 500 character description
- **Reference image upload**: Optional image input for Decart
- **Regenerate button**: Uses same inputs to generate a new variation
- **No stats, no equipment slots, no tags**: Pure simplicity!

**Workflow**:

1. User enters name
2. User writes text description and/or uploads reference image
3. User clicks "Regenerate Character"
4. Decart API generates character image
5. Image displays in preview
6. User can regenerate for variations or save when satisfied

**Technical Notes**:

- Decart API accepts: text prompt + optional reference image
- Store both inputs so user can regenerate later
- Each regeneration creates a new image URL

### Navigation Flow

```
Landing (/)
  │
  ├─> [Host Game] → Environment Selection (/host/environment)
  │                   │
  │                   └─> Host Setup (/host)
  │                         │
  │                         └─> Host Display (/host/:roomId)
  │
  ├─> [Join Game] → Enter Code (/join)
  │                   │
  │                   └─> Character Select (/play/:roomId/select)
  │                         │
  │                         └─> Battle UI (/play/:roomId)
  │
  └─> [My Characters] → Character Gallery (/characters)
                          │
                          ├─> Create Character (/characters/create)
                          │
                          └─> Edit Character (/characters/:id/edit)
```

---

## Server Architecture

### Core Modules

#### 1. Room Manager

```typescript
class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostConnectionId: string): Room {
    const roomId = generateRoomCode(); // 6-char alphanumeric
    const room: Room = {
      id: roomId,
      hostConnectionId,
      players: { player1: null, player2: null },
      state: "waiting",
      battle: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    };

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, connectionId: string, username: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (!room.players.player1) {
      room.players.player1 = {
        connectionId,
        playerId: generateId(),
        username,
        characterId: null,
        ready: false,
      };
    } else if (!room.players.player2) {
      room.players.player2 = {
        connectionId,
        playerId: generateId(),
        username,
        characterId: null,
        ready: false,
      };
    } else {
      return false; // Room full
    }

    return true;
  }

  isRoomFull(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return !!(room?.players.player1 && room?.players.player2);
  }
}
```

#### 2. Reactor Manager

```typescript
class ReactorManager {
  private reactor: Reactor;
  private roomId: string;
  private currentFrame: number = 0;

  async initialize(jwtToken: string) {
    this.reactor = new Reactor({ modelName: "livecore" });

    // Listen for state updates
    this.reactor.on("newMessage", (msg) => {
      if (msg.type === "state") {
        this.currentFrame = msg.data.current_frame;
        // Broadcast to host client
        io.to(this.roomId).emit("reactor:state", {
          currentFrame: this.currentFrame,
          currentPrompt: msg.data.current_prompt,
          paused: msg.data.paused,
        });
      }

      if (msg.type === "event") {
        console.log("Reactor event:", msg.data);
      }
    });

    await this.reactor.connect(jwtToken);
  }

  async scheduleRound(prompt: string, timestamp: number) {
    await this.reactor.sendCommand("schedule_prompt", {
      new_prompt: prompt,
      timestamp,
    });
  }

  async start() {
    await this.reactor.sendCommand("start", {});
  }

  async reset() {
    await this.reactor.sendCommand("reset", {});
    this.currentFrame = 0;
  }

  getVideoTrack(): MediaStreamTrack | null {
    return this.reactor.getVideoTrack();
  }
}
```

#### 3. Decart Character Generator

```typescript
class DecartManager {
  private apiKey: string;

  async generateCharacter(
    textPrompt: string,
    referenceImageUrl?: string,
  ): Promise<string> {
    // Decart API integration (adjust based on actual API)
    const formData = new FormData();
    formData.append("prompt", textPrompt);

    if (referenceImageUrl) {
      // Fetch reference image and append to form
      const imageResponse = await fetch(referenceImageUrl);
      const imageBlob = await imageResponse.blob();
      formData.append("reference_image", imageBlob);
    }

    const response = await fetch("https://api.decart.ai/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    const result = await response.json();

    // Return generated image URL
    return result.image_url;
  }

  async regenerateCharacter(character: Character): Promise<string> {
    // Use stored inputs to regenerate
    return this.generateCharacter(
      character.textPrompt,
      character.referenceImageUrl || undefined,
    );
  }
}
```

#### 4. Battle Manager

Handles battle lifecycle, action submission, and victory conditions.

```typescript
async function processBattleRound(
  roomId: string,
  battle: Battle,
  action1: string,
  action2: string,
) {
  // 1. Notify resolving
  io.to(roomId).emit("battle:resolving", {});

  // 2. Get ChatGPT resolution
  const resolution = await resolveCombat(battle, action1, action2);

  // 3. Apply HP changes
  battle.player1.currentHp += resolution.player1HpChange;
  battle.player2.currentHp += resolution.player2HpChange;

  // Clamp HP
  battle.player1.currentHp = Math.max(
    0,
    Math.min(battle.player1.currentHp, battle.player1.maxHp),
  );
  battle.player2.currentHp = Math.max(
    0,
    Math.min(battle.player2.currentHp, battle.player2.maxHp),
  );

  // 4. Update battle state
  battle.currentState = resolution.newBattleState;
  battle.resolutionHistory.push(resolution);

  // 5. Check victory
  const winner = checkVictory(battle);
  if (winner) {
    battle.winnerId = winner;
    battle.winCondition = "hp_depleted";
    battle.completedAt = new Date();

    await saveBattle(battle);

    io.to(roomId).emit("battle:end", {
      winnerId: winner,
      battle,
      finalResolution: resolution,
    });

    return;
  }

  // 6. Schedule Reactor video
  const reactorManager = getReactorManager(roomId);
  await reactorManager.scheduleRound(
    resolution.videoPrompt,
    reactorManager.currentFrame,
  );

  // 7. Broadcast resolution
  io.to(roomId).emit("battle:round_complete", {
    battle,
    resolution,
  });

  // 8. Clear pending actions
  battle.pendingActions = { player1: null, player2: null };

  // 9. Request next actions
  io.to(roomId).emit("battle:request_actions", {
    timeLimit: 30, // seconds
  });
}

function checkVictory(battle: Battle): string | null {
  if (battle.player1.currentHp <= 0) return battle.player2.playerId;
  if (battle.player2.currentHp <= 0) return battle.player1.playerId;
  return null;
}

async function generateActionSuggestion(
  battle: Battle,
  playerId: string,
): Promise<string> {
  const player =
    battle.player1.playerId === playerId ? battle.player1 : battle.player2;
  const opponent =
    battle.player1.playerId === playerId ? battle.player2 : battle.player1;

  const prompt = `
You are helping a player in a magical battle come up with a creative action.

## Battle Context
Environment: ${battle.currentState.environmentDescription}
Your Character: ${player.character.name} (${player.currentHp}/${player.maxHp} HP)
Your Condition: ${playerId === battle.player1.playerId ? battle.currentState.player1Condition : battle.currentState.player2Condition}
Opponent: ${opponent.character.name} (${opponent.currentHp}/${opponent.maxHp} HP)
Opponent Condition: ${playerId === battle.player1.playerId ? battle.currentState.player2Condition : battle.currentState.player1Condition}

## Previous Events
${battle.currentState.previousEvents.slice(-3).join("\n")}

## Task
Generate ONE creative action (2-3 sentences) that this player could take. 
Be specific, dramatic, and use the environment. 
Make it interesting and different from what they've done before.

Return ONLY the action text, no preamble.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: "You are a creative dungeon master assistant.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.9, // High creativity
    max_tokens: 150,
  });

  return response.choices[0].message.content!.trim();
}
```

---

## Combat Resolution

### ChatGPT Integration

```typescript
async function resolveCombat(
  battle: Battle,
  action1: string,
  action2: string,
): Promise<BattleResolution> {
  const prompt = buildCombatPrompt(battle, action1, action2);

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: COMBAT_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8, // Higher temp for creative outcomes
  });

  const resolution: BattleResolution = JSON.parse(
    response.choices[0].message.content!,
  );

  return resolution;
}
```

### System Prompt

```typescript
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
- Both players start with 50 HP
- Typical damage: 8-15 HP per attack
- Healing: 10-20 HP
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
```

### Context Prompt Builder

```typescript
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
```

---

## API Specifications

### REST Endpoints

```
// Character management
POST   /api/characters                    - Create character
GET    /api/characters                    - List user's characters
GET    /api/characters/:id                - Get character details
PUT    /api/characters/:id                - Update character
DELETE /api/characters/:id                - Delete character

GET    /api/characters/marketplace        - Browse public characters (Phase 3)
POST   /api/characters/:id/purchase       - Buy character (Phase 3)

// Room/Battle
POST   /api/rooms                         - Create room
GET    /api/rooms/:id                     - Get room info
GET    /api/battles/:id                   - Get battle data

// Auth (simplified)
POST   /api/auth/session                  - Create anonymous session
GET    /api/auth/session                  - Get current session
```

### WebSocket Events

#### Client → Server

```typescript
// Character management
{
  type: 'character:create',
  character: Partial<Character>
}

{
  type: 'character:update',
  characterId: string,
  updates: Partial<Character>
}

{
  type: 'character:delete',
  characterId: string
}

// Room management
{
  type: 'room:create',
  username: string,
  environment: string  // Battle arena description
}

{
  type: 'room:join',
  roomId: string,
  username: string
}

{
  type: 'character:select',
  roomId: string,
  characterId: string
}

{
  type: 'player:ready',
  roomId: string
}

// Battle
{
  type: 'battle:action',
  roomId: string,
  actionText: string  // Pure natural language only (500 char max)
}

{
  type: 'battle:generate_action',
  roomId: string
  // Request AI to generate an action suggestion based on current state
}

{
  type: 'battle:forfeit',
  roomId: string
}
```

#### Server → Client

```typescript
// Room events
{
  type: 'room:created',
  roomId: string,
  room: Room
}

{
  type: 'room:player_joined',
  player: PlayerConnection,
  playerSlot: 'player1' | 'player2'
}

{
  type: 'room:full'
}

{
  type: 'character:selected',
  playerId: string,
  character: Character
}

// Battle events
{
  type: 'battle:start',
  battle: Battle
}

{
  type: 'reactor:track',
  track: MediaStreamTrack  // To host only
}

{
  type: 'battle:request_actions',
  timeLimit: number
}

{
  type: 'battle:action_received',
  playerId: string
}

{
  type: 'battle:action_generated',
  playerId: string,
  suggestedAction: string  // AI-generated action suggestion
}

{
  type: 'battle:resolving'
}

{
  type: 'battle:round_complete',
  battle: Battle,
  resolution: BattleResolution
}

{
  type: 'reactor:state',
  currentFrame: number,
  currentPrompt: string | null,
  paused: boolean
}

{
  type: 'battle:end',
  winnerId: string,
  battle: Battle,
  finalResolution: BattleResolution
}
```

---

## Database Schema

### SQLite Schema

```sql
-- Users (optional for Phase 1)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Characters (simplified for Decart single-image generation)
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,

  -- Single generated image
  image_url TEXT NOT NULL,

  -- Generation inputs (for regeneration)
  text_prompt TEXT NOT NULL,           -- 500 char description
  reference_image_url TEXT,            -- Optional reference image

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Room history
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  player1_id TEXT,
  player2_id TEXT,
  winner_id TEXT,
  win_condition TEXT,  -- 'hp_depleted' or 'forfeit'
  environment TEXT,    -- Battle arena description
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Battles (full serialized state)
CREATE TABLE battles (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  battle_data TEXT NOT NULL,  -- JSON serialized Battle object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- Indexes
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_rooms_created_at ON rooms(created_at);
CREATE INDEX idx_battles_room_id ON battles(room_id);
```

---

## Example Battle Flow

### Setup

**Characters:**

- **Player 1 (Zara)**: Fire mage, 60 HP
- **Player 2 (Mordak)**: Ice mage, 80 HP

**Initial State:**

```json
{
  "environmentDescription": "A mystical arena crackling with arcane energy",
  "player1Condition": "Zara stands ready, flames dancing on her fingertips",
  "player2Condition": "Mordak grips his staff, frost spreading at his feet",
  "previousEvents": []
}
```

### Round 1

**Player 1 Input:**

```
"I summon a massive wall of flames between us and advance forward, using it as cover!"
```

**Player 2 Input:**

```
"I create a shield of ice around myself and launch icicle shards through their fire wall!"
```

**ChatGPT Resolution:**

```json
{
  "interpretation": "Player 1 creates fire barrier and advances. Player 2 uses ice shield and launches counter-attack through flames.",

  "player1HpChange": -8,
  "player2HpChange": -5,

  "newBattleState": {
    "environmentDescription": "A towering wall of flames divides the arena, steam billowing where ice meets fire",
    "player1Condition": "Zara advances confidently behind her fire wall, but icicles have pierced her left shoulder",
    "player2Condition": "Mordak is encased in a shimmering ice barrier, but the heat is making it crack",
    "previousEvents": [
      "Zara erected flame wall",
      "Mordak cast ice shield",
      "Mordak launched icicle barrage",
      "Several icicles penetrated flame wall, striking Zara"
    ]
  },

  "videoPrompt": "A towering wall of roaring flames erupts across the arena as Zara steps forward. Mordak raises his hands and a crystalline ice shield materializes around him, reflecting the firelight. He thrusts his palms forward and a volley of razor-sharp icicles shoots through the flames, several finding their mark and striking Zara's shoulder.",

  "diceRolls": [
    {
      "player": "player1",
      "purpose": "flame wall creation",
      "formula": "1d20+6",
      "result": 16,
      "modifier": 6
    },
    {
      "player": "player2",
      "purpose": "ice shield defense",
      "formula": "1d20+5",
      "result": 14,
      "modifier": 5
    },
    {
      "player": "player2",
      "purpose": "icicle attack",
      "formula": "1d20+4",
      "result": 17,
      "modifier": 4
    },
    {
      "player": "player2",
      "purpose": "icicle damage",
      "formula": "2d6+3",
      "result": 11,
      "modifier": 3
    }
  ]
}
```

**Updated State:**

- Player 1 (Zara): 60 → 52 HP
- Player 2 (Mordak): 80 → 75 HP

**Reactor Scheduled:**

```
Frame 0: "A towering wall of roaring flames erupts across the arena as Zara steps forward. Mordak raises his hands and a crystalline ice shield materializes around him, reflecting the firelight. He thrusts his palms forward and a volley of razor-sharp icicles shoots through the flames, several finding their mark and striking Zara's shoulder."
```

### Round 2

**Player 1 Input:**

```
"I drink my health potion and launch a concentrated fireball directly at Mordak!"
```

**Player 2 Input:**

```
"I shatter my ice shield into a thousand shards and send them all flying at Zara!"
```

**ChatGPT Resolution:**

```json
{
  "interpretation": "Player 1 heals and launches fireball. Player 2 weaponizes defensive shield into offensive attack.",

  "player1HpChange": -15, // Net: +20 heal, -35 damage
  "player2HpChange": -18,

  "newBattleState": {
    "environmentDescription": "The arena is filled with steam, melting ice, and the acrid smell of scorched stone",
    "player1Condition": "Zara is bloodied and breathing hard, ice shards embedded in her armor",
    "player2Condition": "Mordak staggers, his robes smoking, badly burned",
    "previousEvents": [
      "Zara drank health potion",
      "Zara launched fireball",
      "Mordak shattered ice shield into projectiles",
      "Ice shards tore into Zara",
      "Fireball struck Mordak directly"
    ]
  },

  "videoPrompt": "Zara quickly downs a glowing potion as Mordak shatters his icy barrier into a thousand gleaming shards. The shards streak toward her like a crystal storm, many finding their mark. Simultaneously, Zara hurls a massive fireball that crashes into the unprotected Mordak, engulfing him in flames.",

  "diceRolls": [
    {
      "player": "player1",
      "purpose": "potion healing",
      "formula": "2d4+2",
      "result": 9,
      "modifier": 2
    },
    {
      "player": "player1",
      "purpose": "fireball attack",
      "formula": "1d20+6",
      "result": 19,
      "modifier": 6
    },
    {
      "player": "player1",
      "purpose": "fireball damage",
      "formula": "3d6+4",
      "result": 18,
      "modifier": 4
    },
    {
      "player": "player2",
      "purpose": "ice shard attack",
      "formula": "1d20+4",
      "result": 20,
      "modifier": 4
    },
    {
      "player": "player2",
      "purpose": "ice shard damage (critical!)",
      "formula": "4d6+3",
      "result": 22,
      "modifier": 3
    }
  ]
}
```

**Updated State:**

- Player 1 (Zara): 52 → 57 HP (healed) → 37 HP (damaged)
- Player 2 (Mordak): 75 → 57 HP

**Battle continues until one player reaches 0 HP...**

---

## Character System

### Character Design Philosophy

Characters in Prompt Pugilists are **single AI-generated images** created via Decart. All gameplay emerges from:

1. **Player creativity** in describing actions
2. **AI interpretation** of those actions
3. **Narrative context** from battle state and environment
4. **Dice rolls** for dramatic tension

### Generation System

**Inputs**:

- **Text Prompt** (required): Up to 500 character description
  - Example: "A fierce fire mage with crimson robes and flames swirling around glowing hands"
- **Reference Image** (optional): Upload an image for Decart to use as reference
  - Can be a photo, artwork, or combination

**Process**:

1. User provides text description and/or reference image
2. Click "Regenerate Character" to call Decart API
3. Decart generates 512x512px character image
4. User can regenerate unlimited times with same inputs (gets variations)
5. Save when satisfied

**Key Features**:

- All characters have **50 HP** (standardized)
- No stats, abilities, or items
- Pure visual representation
- Inputs are saved so characters can be regenerated later

### Default Characters (Starter Set)

For quick play, provide 3-5 pre-generated characters:

1. **Flame Sorceress** - Fire mage in red robes
2. **Frost Knight** - Armored warrior with ice powers
3. **Shadow Rogue** - Dark assassin aesthetic
4. **Nature Shaman** - Druid with wooden staff
5. **Lightning Warrior** - Warrior-mage with electric effects

These serve as examples and starting points for new players.

---

## Development Roadmap

### Phase 1: MVP (6-8 weeks)

#### Week 1-2: Foundation & Character System

- [ ] Project setup (monorepo: client-host, client-player, server)
- [ ] SQLite database + migrations
- [ ] Character data models
- [ ] Character creation UI (mobile)
- [ ] Character gallery UI
- [ ] Pre-made character library (5 characters)
- [ ] Basic authentication (anonymous sessions)

#### Week 3-4: Room & Matchmaking

- [ ] WebSocket server setup (Socket.io)
- [ ] Room creation + join flow
- [ ] Room code generation (6 chars)
- [ ] Player connection management
- [ ] Character selection UI
- [ ] Ready system

#### Week 5-6: Combat Core

- [ ] ChatGPT API integration
- [ ] Combat resolution logic
- [ ] System prompt design + testing
- [ ] Action submission UI (mobile)
- [ ] HP tracking & victory conditions
- [ ] Battle state management

#### Week 7-8: Reactor Integration

- [ ] Reactor SDK setup
- [ ] Video stream to host client
- [ ] Prompt scheduling based on combat resolution
- [ ] LiveCore state management
- [ ] Full battle loop
- [ ] Error handling & reconnection

**Milestone**: Playable end-to-end game

---

### Phase 2: Polish (3-4 weeks)

#### Week 9-10: UX Improvements

- [ ] Mobile UI refinements
- [ ] Better action prompting (tips, suggestions)
- [ ] Visual feedback (animations, transitions)
- [ ] Battle history display
- [ ] Round recap system

#### Week 11-12: Enhancement

- [ ] Character creation improvements (better editor)
- [ ] Image upload for custom characters
- [ ] Battle replay system
- [ ] Analytics & logging
- [ ] Performance optimization

**Milestone**: Production-ready polish

---

### Phase 3: Marketplace & Social (Future)

- [ ] Public character gallery
- [ ] Character rating system
- [ ] Character trading/purchasing
- [ ] User accounts (persistent)
- [ ] Leaderboards
- [ ] Spectator mode
- [ ] Battle replay sharing

---

## Technical Requirements

### Performance Targets (Hackathon Scope)

- **WebSocket latency**: <200ms (acceptable for local play)
- **Action submission to resolution**: <20s
  - ChatGPT response: 3-7s
  - Reactor video generation: 10-15s (per 240 frames)
- **Video playback**: Smooth 30fps, 720p minimum
- **Concurrent battles**: Support 10+ simultaneously (sufficient for demo)

### Simplicity Over Scaling

**Hackathon Priorities**:

- In-memory state only (no Redis, no caching layers)
- Single server instance
- SQLite for persistence
- Focus on working demo, not production scale

**What We're NOT Building**:

- Horizontal scaling
- Load balancers
- Database replication
- CDN integration
- Advanced monitoring

### Error Handling

**Client-Side**:

- Auto-reconnect on WebSocket disconnect (exponential backoff, 3 attempts max)
- Show friendly error messages
- Graceful degradation (if video fails, show static image)

**Server-Side**:

- ChatGPT timeout: 10s, then return generic "epic clash" result
- Decart timeout: 15s, then use placeholder image
- Reactor failure: Show error to host, allow manual retry
- Player disconnect: 30s grace period, then forfeit
- Room cleanup: Auto-delete rooms after 2 hours inactive

### Security

**Authentication**:

- Anonymous sessions (localStorage-based) for Phase 1
- JWT tokens for API requests
- Session validation on WebSocket connection

**Input Validation**:

- Sanitize all action text (prevent injection)
- Rate limit action submissions (1 per 5 seconds)
- Validate character stats on creation (point budget enforcement)

**Anti-Cheat**:

- Server authoritative (all combat calculations server-side)
- Action timestamp validation
- Detect spam/flooding

---

## Cost Estimates

### AI API Costs (per battle, ~5 rounds avg for 50 HP)

**ChatGPT API** (GPT-4-turbo):

- Input tokens: ~2000 tokens/round × 5 rounds = 10,000 tokens
- Output tokens: ~500 tokens/round × 5 rounds = 2,500 tokens
- Cost: ($0.01/1k input + $0.03/1k output)
  - Input: $0.10
  - Output: $0.075
  - **Total per battle: ~$0.175**

**Reactor LiveCore**:

- Pricing: TBD (need to check Reactor pricing)
- Estimate: ~$0.05-0.25 per battle (based on similar services)

**Decart** (Character Generation):

- Per image generation: ~$0.01-0.05 (estimate)
- Most cost during character creation, not battle

**Total per battle**: **$0.23-0.45**

### Hackathon Budget (3 days, 50 battles)

- **AI APIs**: 50 battles × $0.35 = **$17.50**
- **Character generations**: 20 characters × $0.03 = **$0.60**
- **Server**: Free tier (Render/Railway) or $0
- **Total hackathon cost**: **~$20**

### Post-Hackathon Scale (100 battles/day)

- AI APIs: 100 battles/day × 30 days × $0.35 = **$1,050/month**
- Character generations: 200/month × $0.03 = **$6/month**
- Server: $20-50/month
- **Total**: **~$1,100/month** at moderate scale

---

## Monitoring & Analytics

### Key Metrics

**Performance**:

- Average round resolution time
- ChatGPT API latency
- Reactor video generation time
- WebSocket message latency

**Engagement**:

- Daily/monthly active users
- Average battle duration
- Characters created per user
- Battle completion rate
- Round count distribution

**Business**:

- AI API costs per battle
- Server costs per user
- Conversion funnel (signup → first character → first battle)

### Logging

```typescript
interface BattleLog {
  battleId: string;
  roomId: string;
  timestamp: Date;
  player1Action: string;
  player2Action: string;
  chatGptPrompt: string;
  chatGptResponse: string;
  chatGptLatency: number;
  reactorPrompt: string;
  reactorLatency: number;
  resolution: BattleResolution;
}
```

---

## Testing Strategy

### Unit Tests

- Character stat calculations
- HP modifier logic
- Dice roll simulation
- Room code generation
- Victory condition checks

### Integration Tests

- WebSocket message flow
- Room creation/joining
- ChatGPT API mocking
- SQLite operations
- Character CRUD operations

### E2E Tests (Playwright)

- Full character creation flow
- Host + 2 players battle (mocked)
- Action submission
- Battle completion
- Error scenarios (disconnect, timeout)

### Manual Testing

- 3 devices (1 laptop, 2 phones)
- Test latency on local network
- Video quality check
- Mobile UI on various screen sizes

---

## Deployment

### Local Development

```bash
# Server
cd server
npm install
npm run dev

# Host client
cd client-host
npm install
npm run dev

# Player client
cd client-player
npm install
npm run dev
```

### Production (Future)

**Server**: Railway, Render, or Fly.io
**Clients**: Vercel or Netlify
**Database**: SQLite file on server (Litestream for backups)
**Environment Variables**:

```
OPENAI_API_KEY=...
REACTOR_API_KEY=...
DATABASE_PATH=./game.db
PORT=3000
```

---

## Future Enhancements

### Gameplay

- Character progression/XP system
- Equipment slots (armor, weapons, accessories)
- Multiple character classes (warrior, rogue, cleric)
- Environmental effects (weather, terrain)
- Team battles (2v2, 3v3)
- Tournament mode

### Technical

- Mobile apps (React Native)
- Voice input for actions
- Real-time video with reduced latency
- Spectator mode
- Replay system with annotations

### Social

- Friend system
- Guilds/clans
- Global leaderboards
- Character marketplace
- Battle replay sharing
- Community-created characters (curated)

---

## Appendix

### Reactor LiveCore Notes

**Key Constraints**:

- **240 frames per cycle** (0-239)
- **Must schedule prompt at frame 0** before calling `start`
- **Single stream per session** (can't broadcast to multiple clients)
- **Resets to black screen** after frame 239

**Workflow**:

1. Connect to Reactor
2. Schedule initial prompt at frame 0
3. Call `start` command
4. During generation, schedule additional prompts dynamically
5. Listen for state updates (`current_frame`)
6. After 240 frames, reset or schedule new prompts

**State Messages**:

```typescript
{
  type: "state",
  data: {
    current_frame: number,
    current_prompt: string | null,
    paused: boolean,
    scheduled_prompts: { [frame: number]: string }
  }
}
```

**Event Messages**:

```typescript
{
  type: "event",
  data: {
    event: "generation_started" | "prompt_switched" | "error",
    // Additional fields depending on event
  }
}
```

---

## Conclusion

This specification provides a comprehensive blueprint for building **Prompt Pugilists** - a real-time AI battle game built for a hackathon that prioritizes creative freedom and natural language interaction. By leveraging ChatGPT for combat adjudication, Reactor LiveCore for cinematic video generation, and Decart for character creation, players can experience truly dynamic, emergent gameplay where imagination is the only limit.

The Jackbox-style local multiplayer model overcomes Reactor's single-stream limitation while creating a social, party-game atmosphere. The simplified single-image character system powered by Decart removes complexity, allowing players to focus entirely on creative storytelling and dramatic battles.

**Key Features**:

- **Environment Selection**: Hosts choose custom battle arenas
- **AI Action Generation**: Helps players when they're stuck
- **AI Character Generation**: Decart creates unique fighter images from text + optional reference images
- **Pure Creativity**: No stats, no mana, no predefined abilities - just imagination
- **Cinematic Video**: Real-time AI-generated battle footage
- **Hackathon-Friendly**: Simple architecture, clear scope, exciting demo potential

**Hackathon Advantages**:

- Multiple sponsor technologies (Reactor, Decart, ChatGPT)
- Novel gameplay mechanic (natural language combat)
- Great demo potential (visual, exciting, easy to understand)
- Technically ambitious but achievable in 48-72 hours
- Clear MVP scope with room for polish

**Next Steps**:

1. Set up development environment
2. Integrate Decart API for character generation
3. Build basic character creation flow
4. Create proof-of-concept battle loop
5. Integrate Reactor for video
6. Polish UI/UX
7. Prepare demo presentation

---

**Project:** Prompt Pugilists  
**Document Version**: 3.2  
**Last Updated**: February 6, 2026  
**Hackathon**: TBD  
**Sponsors**: Reactor, Decart, OpenAI
