import type { ChatMessage } from "@/components/ChatWidget";

const STORAGE_KEY = "rtg_roomie_chat";

// Detect if we're in a cross-origin iframe (embed mode)
function isEmbed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.parent !== window;
  } catch {
    return true; // cross-origin throws
  }
}

// Post a storage operation to the host page via embed.js bridge
function bridgeSet(key: string, value: string) {
  try {
    window.parent.postMessage({ type: "rtg-storage-set", key, value }, "*");
  } catch { /* ignore */ }
}

function bridgeRemove(key: string) {
  try {
    window.parent.postMessage({ type: "rtg-storage-remove", key }, "*");
  } catch { /* ignore */ }
}

// In-memory cache seeded by rtg-storage-init from embed.js
const memoryCache: Record<string, string> = {};
let bridgeInitialized = false;

// Called when embed.js sends rtg-storage-init with stored data
export function handleStorageInit(data: Record<string, string>) {
  for (const [k, v] of Object.entries(data)) {
    memoryCache[k] = v;
  }
  bridgeInitialized = true;
}

export function isBridgeReady(): boolean {
  return bridgeInitialized;
}

// Try localStorage first, fall back to memory cache
function storageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch { /* blocked by Safari ITP */ }
  return memoryCache[key] ?? null;
}

function storageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  memoryCache[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch { /* blocked */ }
  if (isEmbed()) bridgeSet(key, value);
}

function storageRemove(key: string) {
  if (typeof window === "undefined") return;
  delete memoryCache[key];
  try {
    localStorage.removeItem(key);
  } catch { /* blocked */ }
  if (isEmbed()) bridgeRemove(key);
}

export function saveMessages(messages: ChatMessage[]) {
  const toSave = messages.slice(-100);
  try {
    storageSet(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    const trimmed = messages.slice(-30);
    storageSet(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

export function loadMessages(): ChatMessage[] | null {
  const raw = storageGet(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch { /* corrupted */ }
  return null;
}

export function clearMessages() {
  storageRemove(STORAGE_KEY);
}

// Pending product summary helpers (used by ChatWidget)
export function savePendingProduct(productName: string, url: string) {
  storageSet("rtg_pending_product_summary", JSON.stringify({ url, productName }));
}

export function loadPendingProduct(): { url: string; productName: string } | null {
  const raw = storageGet("rtg_pending_product_summary");
  if (!raw) return null;
  storageRemove("rtg_pending_product_summary");
  try {
    const parsed = JSON.parse(raw);
    if (parsed.productName) return parsed;
  } catch { /* corrupted */ }
  return null;
}
