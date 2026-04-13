"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  generateId,
  readUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { RTGLogo } from "./RTGLogo";
import { WELCOME_MESSAGE } from "@/lib/constants";
import {
  saveMessages,
  loadMessages,
  clearMessages,
  savePendingProduct,
  loadPendingProduct,
  handleStorageInit,
  isBridgeReady,
} from "@/lib/chat-storage";
import { stripStageTag } from "@/lib/stage-tag";
import {
  type VisitorProfile,
  recordVisit,
  loadVisitorProfile,
  updateProfileFromChat,
} from "@/lib/visitor-profile";
import type { PageContext } from "@/lib/system-prompt";
import {
  RTG_PAGE_CONTEXT_MESSAGE,
  isAllowedContextMessageSource,
  sanitizeHostPageContext,
} from "@/lib/page-context";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export type { PageContext };

const CHAT_ID = "rtg-roomie-chat";

const welcomeUi: UIMessage = {
  id: "welcome",
  role: "assistant",
  parts: [{ type: "text", text: WELCOME_MESSAGE }],
};

function getTextFromUIMessage(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function uiMessageToChatMessage(m: UIMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    text: stripStageTag(getTextFromUIMessage(m)),
  };
}

function chatMessageToUi(m: ChatMessage): UIMessage {
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text", text: m.text }],
  };
}

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
  return (window as any).RTG_CHAT_CONTEXT?.dwellThreshold || 30000; // default 30 seconds
}

export function ChatWidget({ embed = false }: { embed?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasInterjected, setHasInterjected] = useState(false);
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(
    null
  );
  const [selectedModel, setSelectedModel] = useState("gemini-flash-3");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handleSendRef = useRef<(text: string) => void>(undefined);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitorProfileRef = useRef(visitorProfile);
  const selectedModelRef = useRef(selectedModel);
  const requestExtrasRef = useRef<Record<string, unknown> | null>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  useEffect(() => {
    visitorProfileRef.current = visitorProfile;
  }, [visitorProfile]);
  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages, body }) => {
          const extras = requestExtrasRef.current;
          requestExtrasRef.current = null;
          const pageCtx = getPageContext();
          return {
            body: {
              id,
              messages,
              ...(body ?? {}),
              visitorProfile: visitorProfileRef.current ?? undefined,
              model: selectedModelRef.current,
              ...(pageCtx ? { pageContext: pageCtx } : {}),
              ...extras,
            },
          };
        },
      }),
    []
  );

  const { messages, sendMessage, setMessages, status, stop } = useChat({
    id: CHAT_ID,
    transport,
    messages: [welcomeUi],
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const displayMessages: ChatMessage[] = messages.map(uiMessageToChatMessage);

  // Listen for sendPrompt + open URL from inline HTML iframes (sandbox cannot navigate top window)
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === RTG_PAGE_CONTEXT_MESSAGE) {
        if (!isAllowedContextMessageSource(e.source)) return;
        const sanitized = sanitizeHostPageContext(e.data.context);
        if (!sanitized) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).RTG_CHAT_CONTEXT = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(window as any).RTG_CHAT_CONTEXT,
          ...sanitized,
        };
        const ctx = getPageContext();
        if (ctx) {
          const updated = recordVisit({
            productName: ctx.productName,
            category: ctx.category,
            purchasedProducts: ctx.purchasedProducts,
          });
          setVisitorProfile(updated);
        }
        return;
      }
      if (e.data?.type === "rtg-open-url" && typeof e.data.url === "string") {
        const raw = e.data.url.trim();
        try {
          const parsed = new URL(raw);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            // Save pending product summary so the widget can auto-ask on next load
            const productName = e.data.productName || parsed.pathname.split("/").pop()?.replace(/-/g, " ") || "";
            if (productName) {
              savePendingProduct(productName, parsed.href);
            }
            // Navigate the host page via embed.js bridge (or top window if not embedded)
            if (window.parent !== window) {
              window.parent.postMessage({ type: "rtg-navigate", url: parsed.href }, "*");
            } else {
              window.location.href = parsed.href;
            }
          }
        } catch {
          /* ignore invalid URLs */
        }
        return;
      }
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
  }, [setVisitorProfile]);

  // Restore chat from storage (direct or via bridge from embed.js)
  const restoreChat = useCallback(() => {
    const saved = loadMessages();
    if (saved && saved.length > 0) {
      setMessages(saved.map(chatMessageToUi));
    }

    const pending = loadPendingProduct();
    if (pending) {
      setIsOpen(true);
      setTimeout(() => {
        handleSendRef.current?.(
          `I just clicked on ${pending.productName}. Give me a quick summary of why this is a good fit for me based on our conversation.`
        );
      }, 500);
    }
  }, [setMessages]);

  // Load persisted messages + record visit on mount
  // In embed mode, wait for rtg-storage-init from host page before restoring
  useEffect(() => {
    const ctx = getPageContext();
    const profile = recordVisit({
      productName: ctx?.productName,
      category: ctx?.category,
      purchasedProducts: ctx?.purchasedProducts,
    });
    setVisitorProfile(profile);

    const inIframe = typeof window !== "undefined" && window.parent !== window;

    if (inIframe) {
      // Listen for storage init from embed.js bridge
      function onStorageInit(e: MessageEvent) {
        if (e.data?.type === "rtg-storage-init" && e.data.data) {
          handleStorageInit(e.data.data);
          restoreChat();
          setLoaded(true);
          window.removeEventListener("message", onStorageInit);
        }
      }
      window.addEventListener("message", onStorageInit);

      // Fallback: if bridge doesn't respond in 1s, try direct localStorage
      const fallbackTimer = setTimeout(() => {
        if (!isBridgeReady()) {
          window.removeEventListener("message", onStorageInit);
          restoreChat();
          setLoaded(true);
        }
      }, 1000);

      return () => {
        window.removeEventListener("message", onStorageInit);
        clearTimeout(fallbackTimer);
      };
    } else {
      // Not embedded — load directly
      restoreChat();
      setLoaded(true);
    }
  }, [setMessages, restoreChat]);

  // Save messages whenever they change
  useEffect(() => {
    if (loaded) {
      saveMessages(displayMessages);
    }
  }, [displayMessages, loaded]);

  // Update visitor profile with preferences when messages change
  useEffect(() => {
    if (loaded && displayMessages.length > 1) {
      updateProfileFromChat(
        displayMessages.map((m) => ({ role: m.role, text: m.text })),
        ""
      );
    }
  }, [displayMessages, loaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function consumeAssistantStream(stream: ReadableStream<UIMessageChunk>) {
    const assistantId = generateId();
    try {
      for await (const uiMessage of readUIMessageStream({ stream })) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantId),
          { ...uiMessage, id: assistantId },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== assistantId),
        {
          id: assistantId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "Sorry, I ran into an issue connecting. Please try again.",
            },
          ],
        },
      ]);
    }
  }

  // Proactive interjection: dwell timer runs regardless of widget open/closed state.
  // Fires once after 30s of idle (no user messages). If widget is closed, opens it.
  // If widget is already open, injects the message into the live conversation.
  useEffect(() => {
    if (hasInterjected || !loaded) return;

    // Don't interject if user has already been chatting
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length > 0) return;

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

      setHasInterjected(true);

      // Open the widget if it's closed
      if (!isOpenRef.current) {
        setIsOpen(true);
      }

      try {
        requestExtrasRef.current = {
          type: "proactive",
          pageContext,
        };
        const chunkStream = await transport.sendMessages({
          trigger: "submit-message",
          chatId: CHAT_ID,
          messageId: undefined,
          messages: [],
          abortSignal: new AbortController().signal,
        });
        await consumeAssistantStream(chunkStream);
      } catch {
        if (!isOpenRef.current) {
          setMessages([welcomeUi]);
        }
      }
    }, threshold);

    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [hasInterjected, loaded, messages, transport, setMessages]);

  // Generate personalized greeting for returning visitors when widget opens
  const generateReturningGreeting = useCallback(async () => {
    const profile = loadVisitorProfile();
    if (profile.visitCount <= 1 && profile.viewedProducts.length === 0) {
      return;
    }

    const saved = loadMessages();
    if (saved && saved.length > 1) {
      return;
    }

    setMessages([]);

    try {
      requestExtrasRef.current = {
        type: "returning",
        visitorProfile: profile,
      };
      const chunkStream = await transport.sendMessages({
        trigger: "submit-message",
        chatId: CHAT_ID,
        messageId: undefined,
        messages: [],
        abortSignal: undefined,
      });
      await consumeAssistantStream(chunkStream);
    } catch {
      setMessages([welcomeUi]);
    }
  }, [transport, setMessages]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (visitorProfile && visitorProfile.visitCount > 1 && messages.length <= 1) {
      generateReturningGreeting();
    }
  }, [visitorProfile, messages.length, generateReturningGreeting]);

  const handleRefresh = useCallback(() => {
    clearMessages();
    setMessages([welcomeUi]);
  }, [setMessages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      await sendMessage({ text: text.trim() });
    },
    [sendMessage, isStreaming]
  );

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (hasInterjected && typeof document !== "undefined") {
      document.cookie = "rtg_proactive_dismissed=1;path=/;max-age=300";
    }
  }, [hasInterjected]);

  return (
    <>
      {/* Toggle button — Shopping Assistant pill */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full px-4 py-3 shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 ${embed ? "pointer-events-auto" : ""}`}
          style={{ backgroundColor: "var(--rtg-blue)" }}
          aria-label="Open Shopping Assistant"
        >
          <RTGLogo size={32} />
          <span
            className="text-sm font-semibold"
            style={{ color: "white" }}
          >
            Shopping Assistant
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className={`widget-enter fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl shadow-2xl ${embed ? "pointer-events-auto" : ""}`}
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
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />

          <ChatMessages
            messages={displayMessages}
            isStreaming={isStreaming}
            messagesEndRef={messagesEndRef}
          />

          <ChatInput
            onSend={handleSend}
            disabled={isStreaming}
            isStreaming={isStreaming}
            onAbort={stop}
            onChipClick={handleSend}
          />
        </div>
      )}
    </>
  );
}
