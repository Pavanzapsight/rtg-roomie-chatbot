import type { ChatMessage } from "@/components/ChatWidget";

const COOKIE_NAME = "rtg_roomie_chat";
const MAX_AGE_DAYS = 30;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0`;
}

export function saveMessages(messages: ChatMessage[]) {
  // Only save the last 50 messages to stay within cookie size limits
  const toSave = messages.slice(-50);
  try {
    setCookie(COOKIE_NAME, JSON.stringify(toSave));
  } catch {
    // Cookie too large — trim further
    const trimmed = messages.slice(-20);
    setCookie(COOKIE_NAME, JSON.stringify(trimmed));
  }
}

export function loadMessages(): ChatMessage[] | null {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Corrupted cookie
  }
  return null;
}

export function clearMessages() {
  deleteCookie(COOKIE_NAME);
}
