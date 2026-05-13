"use client";

import { useState } from "react";
import { WidgetAvatar } from "./WidgetAvatar";
import type { WidgetBranding, WidgetTheme } from "@/lib/widget-config";

export function ChatHeader({
  onMinimize,
  onRefresh,
  onShare,
  branding,
  theme,
}: {
  onMinimize: () => void;
  onRefresh: () => void;
  onShare: () => void;
  branding: WidgetBranding;
  theme: WidgetTheme;
}) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="flex h-14 shrink-0 items-center justify-between border-b px-4"
      style={{
        backgroundColor: "var(--widget-surface)",
        borderColor: "var(--widget-border)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <WidgetAvatar size={32} branding={branding} theme={theme} />
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--widget-text)" }}
        >
          {branding.headerTitle}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleShare}
          className="flex h-8 items-center justify-center gap-1 rounded-full px-2 transition-colors"
          style={{ color: "var(--widget-text-muted)" }}
          aria-label="Share chat"
          title="Share chat"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--widget-surface-alt)";
            e.currentTarget.style.color = "var(--widget-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--widget-text-muted)";
          }}
        >
          {copied ? (
            <span className="text-[10px] font-semibold">Copied!</span>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          )}
        </button>

        <button
          onClick={onRefresh}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ color: "var(--widget-text-muted)" }}
          aria-label="New conversation"
          title="New conversation"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--widget-surface-alt)";
            e.currentTarget.style.color = "var(--widget-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--widget-text-muted)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
        <button
          onClick={onMinimize}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ color: "var(--widget-text-muted)" }}
          aria-label={`Minimize ${branding.headerTitle}`}
          title="Minimize chat"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--widget-surface-alt)";
            e.currentTarget.style.color = "var(--widget-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--widget-text-muted)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
        </button>
      </div>
    </div>
  );
}
