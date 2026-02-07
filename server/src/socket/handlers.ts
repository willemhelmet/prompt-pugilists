import type { Server, Socket } from "socket.io";
import type Database from "better-sqlite3";
import type { ClientEvents, ServerEvents, Character } from "../types.js";
import { roomManager } from "../managers/RoomManager.js";
import { createBattle, applyResolution, checkVictory } from "../managers/BattleManager.js";
import { resolveCombat, generateActionSuggestion } from "../ai/mistral.js";

type IO = Server<ClientEvents, ServerEvents>;
type ClientSocket = Socket<ClientEvents, ServerEvents>;

export function registerSocketHandlers(io: IO, db: Database.Database): void {
  io.on("connection", (socket: ClientSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // ── Room events ──────────────────────────────────────────

    socket.on("room:create", ({ username, environment, environmentImageUrl }) => {
      const room = roomManager.createRoom(socket.id, environment, environmentImageUrl);
      socket.join(room.id);
      socket.emit("room:created", { roomId: room.id, room });
      console.log(`Room ${room.id} created by ${username}`);
    });

    socket.on("room:join", ({ roomId, username }) => {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit("room:error", { message: "Room not found" });
        return;
      }

      const player = roomManager.joinRoom(roomId, socket.id, username);
      if (!player) {
        socket.emit("room:error", { message: "Room is full" });
        return;
      }

      socket.join(roomId);
      const slot = roomManager.getPlayerSlot(roomId, socket.id)!;
      io.to(roomId).emit("room:player_joined", { player, playerSlot: slot });

      if (roomManager.isRoomFull(roomId)) {
        roomManager.setRoomState(roomId, "character_select");
        io.to(roomId).emit("room:full");
      }
    });

    // ── Character selection ──────────────────────────────────

    socket.on("character:select", ({ roomId, characterId }) => {
      const player = roomManager.getPlayerByConnectionId(roomId, socket.id);
      if (!player) return;

      player.characterId = characterId;

      // Fetch character from DB
      const row = db
        .prepare("SELECT * FROM characters WHERE id = ?")
        .get(characterId) as any;

      if (!row) {
        socket.emit("room:error", { message: "Character not found" });
        return;
      }

      const character: Character = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        imageUrl: row.image_url,
        textPrompt: row.text_prompt,
        referenceImageUrl: row.reference_image_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      io.to(roomId).emit("character:selected", {
        playerId: player.playerId,
        character,
      });
    });

    socket.on("player:ready", ({ roomId }) => {
      const player = roomManager.getPlayerByConnectionId(roomId, socket.id);
      if (!player) return;

      player.ready = true;

      const room = roomManager.getRoom(roomId);
      if (!room) return;

      // Check if both players are ready with characters selected
      const p1 = room.players.player1;
      const p2 = room.players.player2;
      if (!p1?.ready || !p2?.ready || !p1.characterId || !p2.characterId) return;

      // Fetch both characters
      const c1 = db.prepare("SELECT * FROM characters WHERE id = ?").get(p1.characterId) as any;
      const c2 = db.prepare("SELECT * FROM characters WHERE id = ?").get(p2.characterId) as any;
      if (!c1 || !c2) return;

      const toChar = (row: any): Character => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        imageUrl: row.image_url,
        textPrompt: row.text_prompt,
        referenceImageUrl: row.reference_image_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });

      // Create battle
      const battle = createBattle(
        roomId,
        toChar(c1),
        toChar(c2),
        p1.playerId,
        p2.playerId,
        room.environment || "A mystical arena crackling with arcane energy",
      );

      room.battle = battle;
      roomManager.setRoomState(roomId, "battle");

      io.to(roomId).emit("battle:start", { battle });
      io.to(roomId).emit("battle:request_actions", { timeLimit: 30 });

      console.log(`Battle started in room ${roomId}: ${c1.name} vs ${c2.name}`);
    });

    // ── Battle events ────────────────────────────────────────

    socket.on("battle:action", async ({ roomId, actionText }) => {
      const room = roomManager.getRoom(roomId);
      if (!room?.battle) return;

      const slot = roomManager.getPlayerSlot(roomId, socket.id);
      if (!slot) return;

      room.battle.pendingActions[slot] = {
        actionText,
        submittedAt: new Date().toISOString(),
      };

      io.to(roomId).emit("battle:action_received", {
        playerId: roomManager.getPlayerByConnectionId(roomId, socket.id)!.playerId,
      });

      // If both actions are in, resolve the round
      if (room.battle.pendingActions.player1 && room.battle.pendingActions.player2) {
        io.to(roomId).emit("battle:resolving");

        const action1 = room.battle.pendingActions.player1.actionText;
        const action2 = room.battle.pendingActions.player2.actionText;

        const resolution = await resolveCombat(room.battle, action1, action2);

        applyResolution(room.battle, resolution);

        // Check victory
        const winnerId = checkVictory(room.battle);
        if (winnerId) {
          room.battle.winnerId = winnerId;
          room.battle.winCondition = "hp_depleted";
          room.battle.completedAt = new Date().toISOString();

          io.to(roomId).emit("battle:end", {
            winnerId,
            battle: room.battle,
            finalResolution: resolution,
          });
          console.log(`Battle ended in room ${roomId}, winner: ${winnerId}`);
        } else {
          io.to(roomId).emit("battle:round_complete", {
            battle: room.battle,
            resolution,
          });

          // Clear pending actions for next round
          room.battle.pendingActions = { player1: null, player2: null };

          io.to(roomId).emit("battle:request_actions", { timeLimit: 30 });
        }
      }
    });

    socket.on("battle:generate_action", async ({ roomId }) => {
      const room = roomManager.getRoom(roomId);
      const player = roomManager.getPlayerByConnectionId(roomId, socket.id);
      if (!player || !room?.battle) return;

      const suggestedAction = await generateActionSuggestion(
        room.battle,
        player.playerId,
      );

      socket.emit("battle:action_generated", {
        playerId: player.playerId,
        suggestedAction,
      });
    });

    socket.on("battle:forfeit", ({ roomId }) => {
      const room = roomManager.getRoom(roomId);
      if (!room?.battle || room.battle.winnerId) return;

      const slot = roomManager.getPlayerSlot(roomId, socket.id);
      if (!slot) return;

      const forfeiter = room.battle[slot];
      const winnerSlot = slot === "player1" ? "player2" : "player1";
      const winner = room.battle[winnerSlot];

      room.battle.winnerId = winner.playerId;
      room.battle.winCondition = "forfeit";
      room.battle.completedAt = new Date().toISOString();

      // Set forfeiter HP to 0 for visual clarity
      forfeiter.currentHp = 0;

      roomManager.setRoomState(roomId, "completed");

      io.to(roomId).emit("battle:end", {
        winnerId: winner.playerId,
        battle: room.battle,
        finalResolution: room.battle.resolutionHistory.at(-1) ?? {
          player1Action: "",
          player2Action: "",
          interpretation: `${forfeiter.character.name} has forfeited the battle. ${winner.character.name} wins!`,
          announcerText: `It's OVER! ${forfeiter.character.name} throws in the towel! ${winner.character.name} wins by FORFEIT!`,
          player1HpChange: 0,
          player2HpChange: 0,
          newBattleState: room.battle.currentState,
          videoPrompt: `${winner.character.name} stands victorious as ${forfeiter.character.name} concedes defeat.`,
          diceRolls: [],
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`Player ${socket.id} (${forfeiter.character.name}) forfeited in room ${roomId}`);
    });

    // ── Disconnect ───────────────────────────────────────────

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      // TODO: handle disconnect grace period
    });
  });
}
