"use client";

import React, { type RefObject, useMemo } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { type ChatMessage } from "./ChatWidget";
import { InlineHTML } from "./InlineHTML";
import { WidgetAvatar } from "./WidgetAvatar";
import { stripStageTag } from "@/lib/stage-tag";
import type { WidgetBranding, WidgetTheme } from "@/lib/widget-config";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div
        className="flex items-center gap-1 rounded-2xl rounded-bl-sm px-4 py-3"
        style={{
          backgroundColor: "var(--widget-surface)",
          border: "1px solid var(--widget-border)",
        }}
      >
        <div className="typing-dot h-2 w-2 rounded-full" />
        <div className="typing-dot h-2 w-2 rounded-full" />
        <div className="typing-dot h-2 w-2 rounded-full" />
      </div>
    </div>
  );
}

interface Segment {
  type: "text" | "html";
  content: string;
}

function isProductCardHtml(html: string): boolean {
  return /class=["'][^"']*\bcard\b/.test(html);
}

function isPillOnlyHtml(html: string): boolean {
  const hasCard = /class=["'][^"']*\bcard\b/.test(html);
  const hasPill = /class=["'][^"']*\bpill\b/.test(html);
  return hasPill && !hasCard;
}

function cleanTextSegment(text: string): string {
  return text
    .replace(/^\s*What would you like to do\?\s*$/gim, "")
    .trim();
}

function parseSegments(rawText: string): Segment[] {
  const text = stripStageTag(rawText);
  const segments: Segment[] = [];
  const htmlBlockRegex = /```html\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = htmlBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = cleanTextSegment(text.slice(lastIndex, match.index));
      if (before) segments.push({ type: "text", content: before });
    }
    segments.push({ type: "html", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    let remaining = text.slice(lastIndex);
    const incompleteStart = remaining.indexOf("```html");
    if (incompleteStart !== -1) {
      remaining = remaining.slice(0, incompleteStart);
    }
    const cleaned = cleanTextSegment(remaining.trim());
    if (cleaned) segments.push({ type: "text", content: cleaned });
  }

  if (segments.length === 0 && !text.includes("```html")) {
    const cleaned = cleanTextSegment(text);
    if (cleaned) segments.push({ type: "text", content: cleaned });
  }

  return segments;
}

function MessageBubble({
  message,
  isLastAssistant,
  isStreaming,
  lastAssistantRef,
  branding,
  theme,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  lastAssistantRef?: React.RefObject<HTMLDivElement | null>;
  branding: WidgetBranding;
  theme: WidgetTheme;
}) {
  const isUser = message.role === "user";

  return (
    <div
      ref={!isUser && isLastAssistant ? lastAssistantRef : undefined}
      className={`chat-bubble-enter flex flex-col ${isUser ? "items-end" : "items-start"} px-4 py-1.5`}
      style={!isUser && isLastAssistant ? { scrollMarginTop: "12vh" } : undefined}
    >
      {!isUser && (
        <div className="mb-1 flex items-center gap-2 pl-1">
          <WidgetAvatar size={24} branding={branding} theme={theme} />
          <span
            className="text-[12px] font-bold"
            style={{ color: "var(--widget-accent)" }}
          >
            {branding.assistantName}
          </span>
        </div>
      )}
      {isUser ? (
        <div
          className="max-w-[88%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[15px] leading-relaxed"
          style={{
            backgroundColor: "var(--widget-user-bubble)",
            color: "var(--widget-text)",
          }}
        >
          {message.text}
        </div>
      ) : (
        <div className="flex w-full max-w-full flex-col gap-2">
          <FormattedMessage
            text={message.text}
            messageId={message.id}
            isStreaming={isLastAssistant && isStreaming}
            theme={theme}
          />
        </div>
      )}
    </div>
  );
}

function FormattedMessage({
  text,
  messageId,
  isStreaming,
  theme,
}: {
  text: string;
  messageId: string;
  isStreaming: boolean;
  theme: WidgetTheme;
}) {
  const segments = useMemo(() => parseSegments(text), [text]);
  const content: React.ReactNode[] = [];

  for (let idx = 0; idx < segments.length; idx++) {
    const seg = segments[idx];

    if (seg.type === "html" && isProductCardHtml(seg.content)) {
      const cardSegments = [seg];

      while (
        idx + 1 < segments.length &&
        segments[idx + 1].type === "html" &&
        isProductCardHtml(segments[idx + 1].content)
      ) {
        cardSegments.push(segments[idx + 1]);
        idx++;
      }

      content.push(
        <div
          key={`${messageId}-cards-${idx}`}
          className="my-1 flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        >
          {cardSegments.map((cardSeg, cardIdx) => (
            <div
              key={`${messageId}-html-${idx}-${cardIdx}`}
              className="w-[312px] shrink-0 snap-start"
            >
              <InlineHTML
                html={cardSeg.content}
                id={`${messageId}-${idx}-${cardIdx}`}
                theme={theme}
              />
            </div>
          ))}
        </div>
      );
      continue;
    }

    if (seg.type === "html") {
      const isPillRow = isPillOnlyHtml(seg.content);

      content.push(
        <div
          key={`${messageId}-html-shell-${idx}`}
          className={isPillRow ? "" : "px-1 py-1"}
        >
          <InlineHTML
            key={`${messageId}-html-${idx}`}
            html={seg.content}
            id={`${messageId}-${idx}`}
            theme={theme}
          />
        </div>
      );
      continue;
    }

    content.push(
      <div
        key={`${messageId}-text-${idx}`}
        className="streamdown-content rounded-2xl px-4 py-3"
        style={{
          border: "1px solid var(--widget-border)",
          backgroundColor: "var(--widget-assistant-bubble)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <Streamdown
          mode={isStreaming ? "streaming" : "static"}
          parseIncompleteMarkdown={isStreaming}
          linkSafety={{ enabled: false }}
          components={{
            a: ({ href, children, ...rest }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--widget-accent)", textDecoration: "underline" }}
                {...rest}
              >
                {children}
              </a>
            ),
          }}
        >
          {seg.content}
        </Streamdown>
      </div>
    );
  }

  return <>{content}</>;
}

export function ChatMessages({
  messages,
  isStreaming,
  messagesEndRef,
  lastAssistantRef,
  scrollContainerRef,
  branding,
  theme,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  lastAssistantRef?: RefObject<HTMLDivElement | null>;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  branding: WidgetBranding;
  theme: WidgetTheme;
}) {
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }

  return (
    <div
      ref={scrollContainerRef}
      className="chat-messages flex-1 overflow-y-auto py-3"
      style={{
        backgroundColor: "var(--widget-surface-alt)",
        overscrollBehavior: "contain",
      }}
    >
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLastAssistant={i === lastAssistantIdx}
          isStreaming={isStreaming}
          lastAssistantRef={lastAssistantRef}
          branding={branding}
          theme={theme}
        />
      ))}
      {isStreaming && messages[messages.length - 1]?.role === "user" && (
        <TypingIndicator />
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
