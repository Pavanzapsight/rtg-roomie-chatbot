import type { ChatMessage } from "@/components/ChatWidget";

const STORAGE_KEY = "rtg_roomie_chat";

export function saveMessages(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  // Keep the last 100 messages
  const toSave = messages.slice(-100);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Storage full — trim further
    const trimmed = messages.slice(-30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

export function loadMessages(): ChatMessage[] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Corrupted data
  }
  return null;
}

export function clearMessages() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
