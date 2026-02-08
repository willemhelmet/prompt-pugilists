const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

// Auth
export const api = {
  createSession: () => request<{ sessionId: string }>("/auth/session", { method: "POST" }),

  // Characters
  getCharacters: () => request<any[]>(`/characters`),

  getCharacter: (id: string) => request<any>(`/characters/${id}`),

  createCharacter: (data: {
    userId: string;
    name: string;
    imageUrl: string;
    textPrompt: string;
    referenceImageUrl?: string;
  }) => request<any>("/characters", { method: "POST", body: JSON.stringify(data) }),

  updateCharacter: (
    id: string,
    data: { name: string; imageUrl: string; textPrompt: string; referenceImageUrl?: string },
  ) => request<any>(`/characters/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCharacter: (id: string) =>
    request<{ deleted: boolean }>(`/characters/${id}`, { method: "DELETE" }),

  // Image generation & upload
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch(`${API_BASE}/upload/image`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || "Upload failed");
    }

    return res.json();
  },

  generateCharacterImage: (prompt: string) =>
    request<{ url: string }>("/upload/generate", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  generateCharacterImageWithReference: async (
    file: File,
    prompt: string,
  ): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("referenceImage", file);
    formData.append("prompt", prompt);

    const res = await fetch(`${API_BASE}/upload/generate-with-reference`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || "Generation failed");
    }

    return res.json();
  },

  // Suggestions (Mistral-powered "Surprise Me")
  suggestCharacter: () =>
    request<{ name: string; prompt: string }>("/suggest/character", { method: "POST" }),

  suggestEnvironment: () =>
    request<{ prompt: string }>("/suggest/environment", { method: "POST" }),

  enhanceCharacterPrompt: (prompt: string) =>
    request<{ enhancedPrompt: string }>("/suggest/enhance-character", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  enhanceEnvironmentPrompt: (prompt: string) =>
    request<{ enhancedPrompt: string }>("/suggest/enhance-environment", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  // Rooms
  getRoom: (id: string) => request<any>(`/rooms/${id}`),
};
