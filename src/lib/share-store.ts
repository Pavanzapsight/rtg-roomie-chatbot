/**
 * Simple in-memory store for shared chats.
 *
 * Shares are ephemeral — they persist only while the serverless function is
 * warm. Cold starts wipe the store. For production, swap this for Vercel KV
 * or a similar persistent KV service.
 */

type SharedChat = {
  messages: Array<{ role: string; text: string }>;
  createdAt: number;
};

// Module-level Map persists across requests within the same serverless instance
const store = new Map<string, SharedChat>();

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function prune() {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(id);
    }
  }
}

function makeId(): string {
  // 7-character alphanumeric ID (enough for ~78 billion combinations)
  return Math.random().toString(36).slice(2, 9);
}

export function putShare(messages: Array<{ role: string; text: string }>): string {
  prune();
  let id = makeId();
  while (store.has(id)) id = makeId();
  store.set(id, { messages, createdAt: Date.now() });
  return id;
}

export function getShare(id: string): Array<{ role: string; text: string }> | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  return entry.messages;
}
