import { api } from "./api";

const SESSION_KEY = "pp_session_id";

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export async function ensureSession(): Promise<string> {
  const existing = getSessionId();
  if (existing) return existing;

  const { sessionId } = await api.createSession();
  localStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}
