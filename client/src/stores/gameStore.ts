import { create } from "zustand";
import type { Room, Battle, Character, BattleResolution, PlayerConnection } from "../types";

interface GameState {
  // Session
  sessionId: string | null;
  username: string | null;

  // Room
  room: Room | null;
  playerSlot: "player1" | "player2" | null;
  isHost: boolean;

  // Players (tracked separately for UI reactivity)
  player1: PlayerConnection | null;
  player2: PlayerConnection | null;

  // Battle
  battle: Battle | null;
  lastResolution: BattleResolution | null;
  isResolving: boolean;
  actionSubmitted: boolean;
  opponentReady: boolean;

  // Characters
  characters: Character[];
  selectedCharacterId: string | null;

  // Errors
  error: string | null;

  // Actions
  setSession: (sessionId: string, username: string) => void;
  setRoom: (room: Room) => void;
  setPlayerSlot: (slot: "player1" | "player2") => void;
  setIsHost: (isHost: boolean) => void;
  setPlayer: (slot: "player1" | "player2", player: PlayerConnection) => void;
  setBattle: (battle: Battle) => void;
  setLastResolution: (resolution: BattleResolution) => void;
  setIsResolving: (resolving: boolean) => void;
  setActionSubmitted: (submitted: boolean) => void;
  setOpponentReady: (ready: boolean) => void;
  setCharacters: (characters: Character[]) => void;
  setSelectedCharacterId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  username: null,
  room: null,
  playerSlot: null,
  isHost: false,
  player1: null,
  player2: null,
  battle: null,
  lastResolution: null,
  isResolving: false,
  actionSubmitted: false,
  opponentReady: false,
  characters: [],
  selectedCharacterId: null,
  error: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setSession: (sessionId, username) => set({ sessionId, username }),
  setRoom: (room) => set({ room }),
  setPlayerSlot: (playerSlot) => set({ playerSlot }),
  setIsHost: (isHost) => set({ isHost }),
  setPlayer: (slot, player) =>
    set(slot === "player1" ? { player1: player } : { player2: player }),
  setBattle: (battle) => set({ battle }),
  setLastResolution: (lastResolution) => set({ lastResolution }),
  setIsResolving: (isResolving) => set({ isResolving }),
  setActionSubmitted: (actionSubmitted) => set({ actionSubmitted }),
  setOpponentReady: (opponentReady) => set({ opponentReady }),
  setCharacters: (characters) => set({ characters }),
  setSelectedCharacterId: (selectedCharacterId) => set({ selectedCharacterId }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
