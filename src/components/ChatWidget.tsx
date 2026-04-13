"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { WELCOME_MESSAGE } from "@/lib/constants";
import { saveMessages, loadMessages, clearMessages } from "@/lib/chat-storage";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

let messageCounter = 0;
function genId() {
  return `msg-${++messageCounter}-${Date.now()}`;
}

const defaultMessages: ChatMessage[] = [
  { id: "welcome", role: "assistant", text: WELCOME_MESSAGE },
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(defaultMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handleSendRef = useRef<(text: string) => void>(undefined);

  // Listen for sendPrompt messages from inline HTML iframes
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "rtg-send-prompt" && e.data.text) {
        handleSendRef.current?.(e.data.text);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Load persisted messages on mount
  useEffect(() => {
    const saved = loadMessages();
    if (saved && saved.length > 0) {
      setMessages(saved);
    }
    setLoaded(true);
  }, []);

  // Save messages whenever they change (after initial load)
  useEffect(() => {
    if (loaded) {
      saveMessages(messages);
    }
  }, [messages, loaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleRefresh = useCallback(() => {
    clearMessages();
    setMessages(defaultMessages);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = { id: genId(), role: "user", text: text.trim() };
      const allMessages = [...messages, userMsg];
      setMessages(allMessages);
      setIsStreaming(true);

      const assistantId = genId();

      try {
        abortRef.current = new AbortController();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({
              id: m.id,
              role: m.role,
              text: m.text,
            })),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("Chat request failed");
        }

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
                // Final complete text — replaces any partial
                fullText = data.text;
              } else if (data.delta && data.text) {
                // Streaming token update — accumulated text so far
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
              // Skip unparseable lines
            }
          }
        }
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
    [messages, isStreaming]
  );

  // Keep ref current for postMessage handler
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  return (
    <>
      {/* Toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
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
            onClose={() => setIsOpen(false)}
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
