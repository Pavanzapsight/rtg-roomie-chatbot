"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { WELCOME_MESSAGE } from "@/lib/constants";
import { saveMessages, loadMessages, clearMessages } from "@/lib/chat-storage";
import {
  type VisitorProfile,
  recordVisit,
  loadVisitorProfile,
  updateProfileFromChat,
} from "@/lib/visitor-profile";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface PageContext {
  page: "pdp" | "category" | "cart" | "homepage" | "search" | "unknown";
  productName?: string;
  productSku?: string;
  category?: string;
  cartItems?: string[];
  searchQuery?: string;
  dwellSeconds?: number;
  pageHistory?: string[];
  purchasedProducts?: string[];
}

let messageCounter = 0;
function genId() {
  return `msg-${++messageCounter}-${Date.now()}`;
}

const defaultMessages: ChatMessage[] = [
  { id: "welcome", role: "assistant", text: WELCOME_MESSAGE },
];

// Read page context from host page
function getPageContext(): PageContext | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (window as any).RTG_CHAT_CONTEXT;
  if (!ctx) return null;
  return {
    page: ctx.page || "unknown",
    productName: ctx.productName,
    productSku: ctx.productSku,
    category: ctx.category,
    cartItems: ctx.cartItems,
    searchQuery: ctx.searchQuery,
    pageHistory: ctx.pageHistory,
    purchasedProducts: ctx.purchasedProducts,
  };
}

function getDwellThreshold(): number {
  if (typeof window === "undefined") return 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).RTG_CHAT_CONTEXT?.dwellThreshold || 0;
}

// Stream a response from the API
async function streamResponse(
  body: Record<string, unknown>,
  assistantId: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) throw new Error("Chat request failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let assistantAdded = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") continue;

      try {
        const data = JSON.parse(payload);
        if (data.error) {
          fullText = `Sorry, something went wrong: ${data.error}`;
        } else if (data.done && data.text) {
          fullText = data.text;
        } else if (data.delta && data.text) {
          fullText = data.text;
        } else if (data.text) {
          fullText = data.text;
        }

        if (!assistantAdded) {
          assistantAdded = true;
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", text: fullText },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: fullText } : m
            )
          );
        }
      } catch {
        // Skip
      }
    }
  }

  return fullText;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(defaultMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(
    null
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handleSendRef = useRef<(text: string) => void>(undefined);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for sendPrompt messages from inline HTML iframes
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "rtg-send-prompt" && e.data.text) {
        if (
          e.data.text === "__dismiss__" ||
          e.data.text.toLowerCase().includes("just browsing") ||
          e.data.text.toLowerCase().includes("not today") ||
          e.data.text.toLowerCase().includes("no thanks") ||
          e.data.text.toLowerCase().includes("just looking")
        ) {
          setIsOpen(false);
          return;
        }
        handleSendRef.current?.(e.data.text);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Listen for page context updates from host page
  useEffect(() => {
    function handleContextUpdate(e: MessageEvent) {
      if (e.data?.type === "rtg-page-context-update") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).RTG_CHAT_CONTEXT = {
          ...(window as any).RTG_CHAT_CONTEXT,
          ...e.data.context,
        };
        // Update visitor profile with new page context
        const ctx = getPageContext();
        if (ctx) {
          const updated = recordVisit({
            productName: ctx.productName,
            category: ctx.category,
            purchasedProducts: ctx.purchasedProducts,
          });
          setVisitorProfile(updated);
        }
      }
    }
    window.addEventListener("message", handleContextUpdate);
    return () => window.removeEventListener("message", handleContextUpdate);
  }, []);

  // Load persisted messages + record visit on mount
  useEffect(() => {
    const saved = loadMessages();
    if (saved && saved.length > 0) {
      setMessages(saved);
    }

    // Record this visit and load visitor profile
    const ctx = getPageContext();
    const profile = recordVisit({
      productName: ctx?.productName,
      category: ctx?.category,
      purchasedProducts: ctx?.purchasedProducts,
    });
    setVisitorProfile(profile);

    setLoaded(true);
  }, []);

  // Save messages whenever they change
  useEffect(() => {
    if (loaded) {
      saveMessages(messages);
    }
  }, [messages, loaded]);

  // Update visitor profile with preferences when messages change
  useEffect(() => {
    if (loaded && messages.length > 1) {
      updateProfileFromChat(
        messages.map((m) => ({ role: m.role, text: m.text })),
        "" // stage will be updated by the API response
      );
    }
  }, [messages, loaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Proactive auto-open: dwell timer
  useEffect(() => {
    if (isOpen || hasAutoOpened || !loaded) return;

    const threshold = getDwellThreshold();
    if (threshold <= 0) return;

    if (typeof document !== "undefined") {
      const dismissed = document.cookie.includes("rtg_proactive_dismissed=1");
      if (dismissed) return;
    }

    dwellTimerRef.current = setTimeout(async () => {
      const pageContext = getPageContext();
      if (!pageContext) return;
      pageContext.dwellSeconds = Math.round(threshold / 1000);

      setHasAutoOpened(true);
      setIsOpen(true);
      setIsStreaming(true);

      const assistantId = genId();
      const controller = new AbortController();

      try {
        await streamResponse(
          { messages: [], type: "proactive", pageContext },
          assistantId,
          setMessages,
          controller.signal
        );
      } catch {
        setMessages(defaultMessages);
      } finally {
        setIsStreaming(false);
      }
    }, threshold);

    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [isOpen, hasAutoOpened, loaded]);

  // Generate personalized greeting for returning visitors when widget opens
  const generateReturningGreeting = useCallback(async () => {
    const profile = loadVisitorProfile();
    if (profile.visitCount <= 1 && profile.viewedProducts.length === 0) {
      return; // First visit, no history — use default welcome
    }

    // Check if there's already a conversation (not just the default welcome)
    const saved = loadMessages();
    if (saved && saved.length > 1) {
      return; // Active conversation exists — don't replace it
    }

    setIsStreaming(true);
    const assistantId = genId();
    const controller = new AbortController();

    try {
      // Clear default welcome
      setMessages([]);

      await streamResponse(
        { messages: [], type: "returning", visitorProfile: profile },
        assistantId,
        setMessages,
        controller.signal
      );
    } catch {
      setMessages(defaultMessages);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    // Check if this is a returning visitor who should get a personalized greeting
    if (visitorProfile && visitorProfile.visitCount > 1 && messages.length <= 1) {
      generateReturningGreeting();
    }
  }, [visitorProfile, messages.length, generateReturningGreeting]);

  const handleRefresh = useCallback(() => {
    clearMessages();
    setMessages(defaultMessages);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        text: text.trim(),
      };
      const allMessages = [...messages, userMsg];
      setMessages(allMessages);
      setIsStreaming(true);

      const assistantId = genId();

      try {
        abortRef.current = new AbortController();

        await streamResponse(
          {
            messages: allMessages.map((m) => ({
              id: m.id,
              role: m.role,
              text: m.text,
            })),
            visitorProfile: visitorProfile || undefined,
          },
          assistantId,
          setMessages,
          abortRef.current.signal
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              text: "Sorry, I ran into an issue connecting. Please try again.",
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, visitorProfile]
  );

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (hasAutoOpened && typeof document !== "undefined") {
      document.cookie = "rtg_proactive_dismissed=1;path=/;max-age=1800";
    }
  }, [hasAutoOpened]);

  return (
    <>
      {/* Toggle button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ backgroundColor: "var(--rtg-red)" }}
          aria-label="Open chat"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div
          className="widget-enter fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{
            width: 420,
            height: 640,
            border: "1px solid var(--rtg-gray-200)",
          }}
        >
          <ChatHeader
            onMinimize={() => setIsOpen(false)}
            onClose={handleClose}
            onRefresh={handleRefresh}
          />

          <ChatMessages
            messages={messages}
            isStreaming={isStreaming}
            messagesEndRef={messagesEndRef}
          />

          <ChatInput
            onSend={handleSend}
            disabled={isStreaming}
            onChipClick={handleSend}
          />
        </div>
      )}
    </>
  );
}
