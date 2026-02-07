// ============================================================
// Character
// ============================================================

export interface Character {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  textPrompt: string;
  referenceImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Room
// ============================================================

export type RoomState =
  | "waiting"
  | "environment_select"
  | "character_select"
  | "battle"
  | "completed";

export interface PlayerConnection {
  connectionId: string;
  playerId: string;
  username: string;
  characterId: string | null;
  ready: boolean;
}

export interface Room {
  id: string;
  hostConnectionId: string;
  players: {
    player1: PlayerConnection | null;
    player2: PlayerConnection | null;
  };
  state: RoomState;
  environment: string | null;
  environmentImageUrl: string | null;
  battle: Battle | null;
  createdAt: string;
  expiresAt: string;
}

// ============================================================
// Battle
// ============================================================

export interface BattlePlayer {
  playerId: string;
  character: Character;
  currentHp: number;
  maxHp: number;
}

export interface BattleState {
  environmentDescription: string;
  player1Condition: string;
  player2Condition: string;
  previousEvents: string[];
}

export interface PendingAction {
  actionText: string;
  submittedAt: string;
}

export interface DiceRoll {
  player: "player1" | "player2";
  purpose: string;
  formula: string;
  result: number;
  modifier: number;
}

export interface BattleResolution {
  player1Action: string;
  player2Action: string;
  interpretation: string;
  announcerText: string;
  player1HpChange: number;
  player2HpChange: number;
  newBattleState: BattleState;
  videoPrompt: string;
  diceRolls: DiceRoll[];
  timestamp: string;
}

export type WinCondition = "hp_depleted" | "forfeit";

export interface Battle {
  id: string;
  roomId: string;
  player1: BattlePlayer;
  player2: BattlePlayer;
  currentState: BattleState;
  pendingActions: {
    player1: PendingAction | null;
    player2: PendingAction | null;
  };
  resolutionHistory: BattleResolution[];
  winnerId: string | null;
  winCondition: WinCondition | null;
  createdAt: string;
  completedAt: string | null;
}

// ============================================================
// WebSocket Events: Client → Server
// ============================================================

export interface ClientEvents {
  "room:create": (data: {
    username: string;
    environment: string;
    environmentImageUrl?: string;
  }) => void;
  "room:join": (data: { roomId: string; username: string }) => void;
  "character:select": (data: { roomId: string; characterId: string }) => void;
  "player:ready": (data: { roomId: string }) => void;
  "battle:action": (data: { roomId: string; actionText: string }) => void;
  "battle:generate_action": (data: { roomId: string }) => void;
  "battle:forfeit": (data: { roomId: string }) => void;
}

// ============================================================
// WebSocket Events: Server → Client
// ============================================================

export interface ServerEvents {
  "room:created": (data: { roomId: string; room: Room }) => void;
  "room:player_joined": (data: {
    player: PlayerConnection;
    playerSlot: "player1" | "player2";
  }) => void;
  "room:full": () => void;
  "room:error": (data: { message: string }) => void;
  "character:selected": (data: {
    playerId: string;
    character: Character;
  }) => void;
  "battle:start": (data: { battle: Battle }) => void;
  "battle:request_actions": (data: { timeLimit: number }) => void;
  "battle:action_received": (data: { playerId: string }) => void;
  "battle:action_generated": (data: {
    playerId: string;
    suggestedAction: string;
  }) => void;
  "battle:resolving": () => void;
  "battle:round_complete": (data: {
    battle: Battle;
    resolution: BattleResolution;
  }) => void;
  "battle:end": (data: {
    winnerId: string;
    battle: Battle;
    finalResolution: BattleResolution;
  }) => void;
  "reactor:state": (data: {
    currentFrame: number;
    currentPrompt: string | null;
    paused: boolean;
  }) => void;
}

// ============================================================
// Constants
// ============================================================

export const MAX_HP = 40;
export const ACTION_CHAR_LIMIT = 500;
export const ENVIRONMENT_CHAR_LIMIT = 300;
export const CHARACTER_PROMPT_CHAR_LIMIT = 500;
export const ROOM_CODE_LENGTH = 6;
