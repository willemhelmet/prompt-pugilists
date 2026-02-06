import { useState } from "react";
import { Link, useLocation } from "wouter";
import { CHARACTER_PROMPT_CHAR_LIMIT } from "../types";
import { useGameStore } from "../stores/gameStore";
import { api } from "../lib/api";

export function CharacterCreate() {
  const [name, setName] = useState("");
  const [textPrompt, setTextPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, navigate] = useLocation();
  const sessionId = useGameStore((s) => s.sessionId);

  function handleGenerate() {
    if (!textPrompt.trim()) return;
    // TODO: call Decart API — for now use a placeholder
    const seed = encodeURIComponent(textPrompt.trim().slice(0, 40));
    setImageUrl(`https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`);
  }

  async function handleSave() {
    if (!name.trim() || !textPrompt.trim() || !sessionId || saving) return;
    setSaving(true);

    const finalImage =
      imageUrl || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(name)}`;

    try {
      await api.createCharacter({
        userId: sessionId,
        name: name.trim(),
        imageUrl: finalImage,
        textPrompt: textPrompt.trim(),
      });
      navigate("/characters");
    } catch (err) {
      console.error("Failed to save character:", err);
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen p-6 gap-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center w-full">
        <h2 className="text-2xl font-bold">Create Character</h2>
        <Link
          href="/characters"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Back
        </Link>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Character Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500"
          placeholder="Zara the Pyromancer"
          maxLength={50}
        />
      </div>

      {/* Preview */}
      <div className="w-full aspect-square bg-gray-900 border border-gray-700 rounded-xl flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <p className="text-gray-500">Click "Generate Preview" to see your character</p>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Describe your character</label>
        <textarea
          value={textPrompt}
          onChange={(e) => setTextPrompt(e.target.value.slice(0, CHARACTER_PROMPT_CHAR_LIMIT))}
          className="w-full h-28 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-indigo-500"
          placeholder="A fierce fire mage wearing crimson robes with glowing embers swirling around her hands"
        />
        <p className="text-xs text-gray-500 mt-1">
          {textPrompt.length}/{CHARACTER_PROMPT_CHAR_LIMIT}
        </p>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!textPrompt.trim()}
        className="w-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-600 border border-gray-700 py-3 rounded-lg font-semibold transition-colors"
      >
        Generate Preview
      </button>

      <button
        onClick={handleSave}
        disabled={!name.trim() || !textPrompt.trim() || saving}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 py-3 rounded-lg font-semibold text-lg transition-colors"
      >
        {saving ? "Saving..." : "Save Character"}
      </button>
    </div>
  );
}
