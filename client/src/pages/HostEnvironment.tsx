import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ENVIRONMENT_CHAR_LIMIT } from "../types";
import { socket, connectSocket } from "../lib/socket";
import { useGameStore } from "../stores/gameStore";

const PRESETS = [
  { label: "Volcanic Arena", description: "A volcanic arena with rivers of molten lava crisscrossing the obsidian floor" },
  { label: "Ancient Temple", description: "A crumbling ancient temple with pillars of light and floating rune stones" },
  { label: "Enchanted Forest", description: "A dark enchanted forest with bioluminescent plants and whispering trees" },
  { label: "Ruined Castle", description: "A ruined castle courtyard under a stormy sky with lightning strikes" },
  { label: "Storm Peak", description: "A mountain peak above the clouds, lashed by wind and crackling lightning" },
  { label: "Floating Islands", description: "Floating islands connected by chains over a bottomless void" },
];

export function HostEnvironment() {
  const [environment, setEnvironment] = useState("");
  const [creating, setCreating] = useState(false);
  const [, navigate] = useLocation();
  const { setRoom, setIsHost } = useGameStore();

  useEffect(() => {
    connectSocket();

    function onRoomCreated({ roomId, room }: { roomId: string; room: any }) {
      setRoom(room);
      setIsHost(true);
      navigate(`/host/${roomId}`);
    }

    socket.on("room:created", onRoomCreated);

    return () => {
      socket.off("room:created", onRoomCreated);
    };
  }, [navigate, setRoom, setIsHost]);

  function handleContinue() {
    if (!environment.trim() || creating) return;
    setCreating(true);
    socket.emit("room:create", { username: "Host", environment: environment.trim() });
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-6 gap-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold">Set Battle Arena</h2>

      <div className="w-full">
        <label className="block text-sm text-gray-400 mb-2">
          Describe the battle environment:
        </label>
        <textarea
          value={environment}
          onChange={(e) => setEnvironment(e.target.value.slice(0, ENVIRONMENT_CHAR_LIMIT))}
          className="w-full h-28 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-indigo-500"
          placeholder="A volcanic arena with rivers of molten lava..."
        />
        <p className="text-xs text-gray-500 mt-1">
          {environment.length}/{ENVIRONMENT_CHAR_LIMIT}
        </p>
      </div>

      <div className="w-full">
        <p className="text-sm text-gray-400 mb-3">Or choose a preset:</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setEnvironment(preset.description)}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-3 text-sm text-left transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!environment.trim() || creating}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 py-3 rounded-lg font-semibold text-lg transition-colors"
      >
        {creating ? "Creating room..." : "Continue"}
      </button>
    </div>
  );
}
