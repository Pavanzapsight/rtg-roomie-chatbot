"use client";

import { type RefObject, useMemo } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { type ChatMessage } from "./ChatWidget";
import { InlineHTML } from "./InlineHTML";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div
        className="flex items-center gap-1 rounded-2xl rounded-bl-sm px-4 py-3"
        style={{ backgroundColor: "var(--rtg-cream)" }}
      >
        <div className="typing-dot h-2 w-2 rounded-full" />
        <div className="typing-dot h-2 w-2 rounded-full" />
        <div className="typing-dot h-2 w-2 rounded-full" />
      </div>
    </div>
  );
}

// Split text into plain markdown and HTML blocks
interface Segment {
  type: "text" | "html";
  content: string;
}

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const htmlBlockRegex = /```html\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = htmlBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) segments.push({ type: "text", content: before });
    }
    segments.push({ type: "html", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    let remaining = text.slice(lastIndex);
    // Hide incomplete ```html blocks during streaming
    const incompleteStart = remaining.indexOf("```html");
    if (incompleteStart !== -1) {
      remaining = remaining.slice(0, incompleteStart);
    }
    const trimmed = remaining.trim();
    if (trimmed) segments.push({ type: "text", content: trimmed });
  }

  if (segments.length === 0 && !text.includes("```html")) {
    segments.push({ type: "text", content: text });
  }

  return segments;
}

function MessageBubble({
  message,
  isLastAssistant,
  isStreaming,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`chat-bubble-enter flex ${isUser ? "justify-end" : "justify-start"} px-4 py-1`}
    >
      <div
        className={`max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed ${
          isUser
            ? "rounded-2xl rounded-br-sm"
            : "rounded-2xl rounded-bl-sm chat-content"
        }`}
        style={{
          backgroundColor: isUser ? "var(--rtg-gray-50)" : "var(--rtg-cream)",
          color: "var(--rtg-charcoal)",
        }}
      >
        {isUser ? (
          message.text
        ) : (
          <FormattedMessage
            text={message.text}
            messageId={message.id}
            isStreaming={isLastAssistant && isStreaming}
          />
        )}
      </div>
    </div>
  );
}

function FormattedMessage({
  text,
  messageId,
  isStreaming,
}: {
  text: string;
  messageId: string;
  isStreaming: boolean;
}) {
  const segments = useMemo(() => parseSegments(text), [text]);

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === "html") {
          return (
            <InlineHTML
              key={`${messageId}-html-${idx}`}
              html={seg.content}
              id={`${messageId}-${idx}`}
            />
          );
        }
        return (
          <div key={`${messageId}-text-${idx}`} className="streamdown-content">
            <Streamdown
              mode={isStreaming ? "streaming" : "static"}
              parseIncompleteMarkdown={isStreaming}
            >
              {seg.content}
            </Streamdown>
          </div>
        );
      })}
    </>
  );
}

export function ChatMessages({
  messages,
  isStreaming,
  messagesEndRef,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}) {
  // Find the last assistant message index for streaming indicator
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }

  return (
    <div
      className="chat-messages flex-1 overflow-y-auto py-3"
      style={{ backgroundColor: "var(--rtg-white)" }}
    >
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLastAssistant={i === lastAssistantIdx}
          isStreaming={isStreaming}
        />
      ))}
      {isStreaming && messages[messages.length - 1]?.role === "user" && (
        <TypingIndicator />
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
