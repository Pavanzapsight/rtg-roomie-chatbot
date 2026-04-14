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
  initFromBridge,
} from "@/lib/chat-storage";
import { stripStageTag } from "@/lib/stage-tag";
import {
  type VisitorProfile,
  recordVisit,
  loadVisitorProfile,
  updateProfileFromChat,
  initProfileFromBridge,
} from "@/lib/visitor-profile";
import type { PageContext, BrowsingHistoryEntry } from "@/lib/system-prompt";
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

// Read page context from host page (standalone mode only)
function getPageContext(): PageContext | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (window as any).RTG_CHAT_CONTEXT;
  if (!ctx) return null;
  return {
    page: ctx.page || "unknown",
    productName: ctx.productName,
    productSku: ctx.productSku,
    productPrice: ctx.productPrice,
    productVendor: ctx.productVendor,
    productType: ctx.productType,
    productDescription: ctx.productDescription,
    productImage: ctx.productImage,
    productUrl: ctx.productUrl,
    productTags: ctx.productTags,
    category: ctx.category,
    cartItems: ctx.cartItems,
    cartTotal: ctx.cartTotal,
    cartCount: ctx.cartCount,
    searchQuery: ctx.searchQuery,
    pageHistory: ctx.pageHistory,
    purchasedProducts: ctx.purchasedProducts,
    browsingHistory: ctx.browsingHistory,
  };
}

export function ChatWidget({ embed = false }: { embed?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(null);
  const selectedModel = "gemini-flash-3";
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [browsingHistory, setBrowsingHistory] = useState<BrowsingHistoryEntry[]>([]);
  const [humanMode, setHumanMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAssistantRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const handleSendRef = useRef<(text: string) => void>(undefined);
  const visitorProfileRef = useRef(visitorProfile);
  const selectedModelRef = useRef(selectedModel);
  const pageContextRef = useRef(pageContext);
  const browsingHistoryRef = useRef(browsingHistory);
  const requestExtrasRef = useRef<Record<string, unknown> | null>(null);
  const isOpenRef = useRef(isOpen);
  const lastAutoProductRef = useRef<string>("");

  useEffect(() => {
    isOpenRef.current = isOpen;
    // Tell embed.js to resize the iframe
    if (embed && typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage(
        { type: isOpen ? "rtg-widget-open" : "rtg-widget-close" },
        "*"
      );
    }
  }, [isOpen, embed]);
  useEffect(() => { visitorProfileRef.current = visitorProfile; }, [visitorProfile]);
  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { pageContextRef.current = pageContext; }, [pageContext]);
  useEffect(() => { browsingHistoryRef.current = browsingHistory; }, [browsingHistory]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages, body }) => {
          const extras = requestExtrasRef.current;
          requestExtrasRef.current = null;
          const ctx = pageContextRef.current || getPageContext();
          return {
            body: {
              id,
              messages,
              ...(body ?? {}),
              visitorProfile: visitorProfileRef.current ?? undefined,
              model: selectedModelRef.current,
              ...(ctx ? { pageContext: ctx } : {}),
              browsingHistory: browsingHistoryRef.current.length > 0
                ? browsingHistoryRef.current : undefined,
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

  // ── Message listener: handles bridge init, context updates, URL clicks, prompts ──
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // rtg-init: full initialization from embed.js
      if (e.data?.type === "rtg-init") {
        const data = e.data;

        // Seed storage from host page's localStorage
        initFromBridge(data.chatMessages || null, true);
        initProfileFromBridge(data.visitorProfile || null, true);

        // Set page context and browsing history
        if (data.pageContext) setPageContext(data.pageContext);
        if (data.browsingHistory) setBrowsingHistory(data.browsingHistory);

        // Restore chat messages
        const saved = loadMessages();
        if (saved && saved.length > 0) {
          setMessages(saved.map(chatMessageToUi));
        }

        // Record visit
        const profile = recordVisit({
          productName: data.pageContext?.productName,
          category: data.pageContext?.category,
          purchasedProducts: data.pageContext?.purchasedProducts,
        });
        setVisitorProfile(profile);

        // Handle pending product summary
        if (data.pendingProduct && data.pendingProduct.productName) {
          setIsOpen(true);
          setTimeout(() => {
            handleSendRef.current?.(
              `I just clicked on ${data.pendingProduct.productName}. Give me a quick summary of why this is a good fit for me based on our conversation. Then show me action buttons for Add to Cart and Compare with other options.`
            );
          }, 800);
        }

        // Auto-open the widget when a shared chat link is loaded
        if (data.isSharedChat) {
          setIsOpen(true);
        }

        // Restore previous open/closed state across page navigations
        if (data.widgetOpen) {
          setIsOpen(true);
        }

        setLoaded(true);
        return;
      }

      // Page context update (from embed.js on SPA navigation or async data)
      if (e.data?.type === RTG_PAGE_CONTEXT_MESSAGE) {
        if (!isAllowedContextMessageSource(e.source)) return;
        const sanitized = sanitizeHostPageContext(e.data.context);
        if (!sanitized) return;

        // In embed mode, update React state directly
        setPageContext((prev) => prev ? { ...prev, ...sanitized } : sanitized);

        // Also update window context for standalone compatibility
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).RTG_CHAT_CONTEXT = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(window as any).RTG_CHAT_CONTEXT,
          ...sanitized,
        };
        const ctx = sanitized;
        if (ctx.productName || ctx.category) {
          const updated = recordVisit({
            productName: ctx.productName,
            category: ctx.category,
            purchasedProducts: ctx.purchasedProducts,
          });
          setVisitorProfile(updated);
        }

        // Auto-show product info when user navigates to a new product page
        if (
          ctx.page === "pdp" &&
          ctx.productName &&
          ctx.productName !== lastAutoProductRef.current
        ) {
          lastAutoProductRef.current = ctx.productName;
          // Small delay to let enriched data (description, price) arrive
          setTimeout(() => {
            handleSendRef.current?.(
              `I'm now looking at ${ctx.productName}${ctx.productPrice ? " (" + ctx.productPrice + ")" : ""}. Tell me about this product and show me options to Add to Cart, Compare, or keep browsing.`
            );
          }, 1500);
        }
        return;
      }

      // Product link click from InlineHTML iframe
      if (e.data?.type === "rtg-open-url" && typeof e.data.url === "string") {
        const raw = e.data.url.trim();
        try {
          const parsed = new URL(raw);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            const productName = e.data.productName
              || parsed.pathname.split("/").pop()?.replace(/-/g, " ")
              || "";

            if (embed) {
              // Send to embed.js: save pending product + navigate host page
              window.parent.postMessage({
                type: "rtg-navigate",
                url: parsed.href,
                pendingProduct: productName ? { productName, url: parsed.href } : undefined,
              }, "*");
            } else {
              // Standalone: navigate directly
              window.location.href = parsed.href;
            }
          }
        } catch { /* ignore invalid URLs */ }
        return;
      }

      // Quick-reply prompt from InlineHTML iframe
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
  }, [embed, setMessages]);

  // ── Standalone init (non-embed mode) ──
  useEffect(() => {
    if (embed) return; // embed mode waits for rtg-init message

    initFromBridge(null, false);
    initProfileFromBridge(null, false);

    const saved = loadMessages();
    if (saved && saved.length > 0) {
      setMessages(saved.map(chatMessageToUi));
    }

    const ctx = getPageContext();
    if (ctx) setPageContext(ctx);

    const profile = recordVisit({
      productName: ctx?.productName,
      category: ctx?.category,
      purchasedProducts: ctx?.purchasedProducts,
    });
    setVisitorProfile(profile);

    setLoaded(true);
  }, [embed, setMessages]);

  // Save messages whenever they change (to bridge or localStorage)
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

  // Scroll to bottom when widget opens or chat is restored.
  // Product card iframes resize asynchronously (images load, content expands),
  // so a single scrollTop assignment lands "in the middle". We use a
  // ResizeObserver to keep snapping to the bottom while the container grows,
  // for a short window after the widget opens.
  useEffect(() => {
    if (!isOpen) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    function toBottom() {
      if (container) container.scrollTop = container.scrollHeight;
    }

    // Initial scrolls at staggered times to catch late-loading iframes
    requestAnimationFrame(toBottom);
    const timers = [
      setTimeout(toBottom, 100),
      setTimeout(toBottom, 300),
      setTimeout(toBottom, 800),
    ];

    // Watch for content size changes during the first ~1.5s
    let pinToBottom = true;
    const observer = new ResizeObserver(() => {
      if (pinToBottom) toBottom();
    });
    observer.observe(container);
    const stopPin = setTimeout(() => { pinToBottom = false; }, 1500);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(stopPin);
      observer.disconnect();
    };
  }, [isOpen, loaded]);

  // Scroll so the top of the new AI response sits at 20% from top (leaving 80% for reading)
  const lastAssistantMessageId = messages.findLast((m) => m.role === "assistant")?.id;
  const prevAssistantIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!lastAssistantMessageId || lastAssistantMessageId === prevAssistantIdRef.current) return;
    // Only trigger when a brand-new assistant message appears (not on every chunk update)
    if (status !== "streaming" && status !== "submitted") return;
    prevAssistantIdRef.current = lastAssistantMessageId;

    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const el = lastAssistantRef.current;
      if (!container || !el) return;

      // Walk offsetParent chain to get true offset relative to the scroll container
      let offsetTop = 0;
      let node: HTMLElement | null = el;
      while (node && node !== container) {
        offsetTop += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }

      container.scrollTo({ top: offsetTop - container.clientHeight * 0.2, behavior: "smooth" });
    });
  }, [lastAssistantMessageId, status]);

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
    setHumanMode(false);
  }, [setMessages]);

  const handleShare = useCallback(async () => {
    const shareableMessages = displayMessages.filter((m) => m.id !== "welcome");
    if (shareableMessages.length === 0) return;

    try {
      const json = JSON.stringify(
        shareableMessages.map((m) => ({ role: m.role, text: m.text }))
      );

      // Gzip-compress and URL-safe base64 encode so the link is
      // self-contained (works across browsers/devices) but much shorter
      // than raw base64.
      const stream = new Blob([json]).stream().pipeThrough(
        new CompressionStream("gzip")
      );
      const buffer = await new Response(stream).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const encoded = btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const url = `https://rtg-275.myshopify.com/?chat=${encoded}`;

      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const el = document.createElement("textarea");
        el.value = url;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
    } catch {
      /* share failed silently */
    }
  }, [displayMessages]);

  const HANDOFF_PHRASES = [
    "talk to someone",
    "talk to a person",
    "talk to a human",
    "speak to someone",
    "speak to a person",
    "speak to a human",
    "speak to an agent",
    "talk to an agent",
    "human agent",
    "real person",
    "live agent",
    "customer service",
    "customer support",
    "representative",
  ];

  const triggerHandoff = useCallback(async () => {
    // 1. Show transfer message
    const transferId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: transferId,
        role: "assistant",
        parts: [{ type: "text", text: "Sure, transferring you to a human agent." }],
      },
    ]);

    // 2. Get summary from API
    let summary = "";
    try {
      requestExtrasRef.current = { type: "summarize" };
      const chunkStream = await transport.sendMessages({
        trigger: "submit-message",
        chatId: CHAT_ID,
        messageId: undefined,
        messages: messages,
        abortSignal: new AbortController().signal,
      });
      for await (const uiMessage of readUIMessageStream({ stream: chunkStream })) {
        summary = uiMessage.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("");
      }
    } catch {
      // summary stays empty
    }

    // 3. Show Joan's greeting with summary
    const joanId = generateId();
    const joanText = summary
      ? `Hello, this is Joan! I can see you've been ${summary} How can I help you today?`
      : `Hello, this is Joan! How may I help you today?`;
    setMessages((prev) => [
      ...prev,
      {
        id: joanId,
        role: "assistant",
        parts: [{ type: "text", text: joanText }],
      },
    ]);

    // 4. Lock out AI
    setHumanMode(true);
  }, [messages, transport, setMessages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || humanMode) return;

      // Check for handoff intent
      const lower = text.toLowerCase();
      if (HANDOFF_PHRASES.some((phrase) => lower.includes(phrase))) {
        // First append the user message so it shows in chat
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "user",
            parts: [{ type: "text", text: text.trim() }],
          },
        ]);
        await triggerHandoff();
        return;
      }

      await sendMessage({ text: text.trim() });
    },
    [sendMessage, isStreaming, humanMode, triggerHandoff, setMessages]
  );

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

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
            onShare={handleShare}
          />

          <ChatMessages
            messages={displayMessages}
            isStreaming={isStreaming}
            messagesEndRef={messagesEndRef}
            lastAssistantRef={lastAssistantRef}
            scrollContainerRef={scrollContainerRef}
          />

          <ChatInput
            onSend={handleSend}
            disabled={isStreaming || humanMode}
            isStreaming={isStreaming}
            humanMode={humanMode}
            onAbort={stop}
            onChipClick={handleSend}
          />
        </div>
      )}
    </>
  );
}
