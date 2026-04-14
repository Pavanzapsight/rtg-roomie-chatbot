"use client";

import { useState } from "react";
import { RTGLogo } from "./RTGLogo";

const MODELS = [
  { key: "gemini-flash-3", label: "Gemini Flash 3.0" },
  { key: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { key: "gpt-5.4", label: "GPT 5.4" },
];

export function ChatHeader({
  onMinimize,
  onClose,
  onRefresh,
  onShare,
  selectedModel,
  onModelChange,
}: {
  onMinimize: () => void;
  onClose: () => void;
  onRefresh: () => void;
  onShare: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div
      className="flex h-16 shrink-0 items-center justify-between px-4"
      style={{ backgroundColor: "var(--rtg-blue)" }}
    >
      <div className="flex items-center gap-2.5">
        <RTGLogo size={36} />
        <div className="flex flex-col">
          <span
            className="text-sm font-bold leading-tight tracking-wide"
            style={{ color: "white" }}
          >
            ROOMS TO GO
          </span>
          <span
            className="text-xs font-medium leading-tight"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            Shopping Assistant
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="h-7 rounded-md border-0 px-1 text-[10px] font-medium"
          style={{
            backgroundColor: "rgba(255,255,255,0.15)",
            color: "white",
            outline: "none",
            maxWidth: 120,
          }}
          aria-label="Select AI model"
        >
          {MODELS.map((m) => (
            <option
              key={m.key}
              value={m.key}
              style={{ color: "#1A1A1A", backgroundColor: "white" }}
            >
              {m.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleShare}
          className="flex h-8 items-center justify-center gap-1 rounded-full px-2 transition-colors hover:bg-white/20"
          aria-label="Share chat"
          title="Share chat"
        >
          {copied ? (
            <span className="text-[10px] font-semibold" style={{ color: "white" }}>Copied!</span>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          )}
        </button>

        <button
          onClick={onRefresh}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          aria-label="New conversation"
          title="New conversation"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
        <button
          onClick={onMinimize}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          aria-label="Minimize chat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M5 12h14" /></svg>
        </button>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          aria-label="Close chat"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
