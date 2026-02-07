const API_URL = "https://neocortex.link/api/v2/audio/generate";

const API_KEY = import.meta.env.VITE_NEOCORTEX_API_KEY as string | undefined;
const CHARACTER_KEY = import.meta.env.VITE_NEOCORTEX_CHARACTER_KEY as string | undefined;

export function isAnnouncerAvailable(): boolean {
  return Boolean(API_KEY && CHARACTER_KEY);
}

export async function generateSpeech(text: string): Promise<Blob> {
  if (!API_KEY || !CHARACTER_KEY) {
    throw new Error("Neocortex API key or character key not configured");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      message: text,
      characterId: CHARACTER_KEY,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[Neocortex TTS] ${response.status} — body:`, body, "— sent message:", text);
    throw new Error(`Neocortex TTS failed: ${response.status} ${body}`);
  }

  return response.blob();
}
