"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";

const QUICK_CHIPS = [
  "Side sleeper",
  "Back sleeper",
  "Under $1,000",
  "Queen size",
  "Cooling mattress",
  "Firm mattress",
];

export function ChatInput({
  onSend,
  disabled,
  onChipClick,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  onChipClick: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const [showChips, setShowChips] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the input when not disabled
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
    setShowChips(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChipClick = (chip: string) => {
    onChipClick(chip);
    setShowChips(false);
  };

  return (
    <div style={{ borderTop: "1px solid var(--rtg-gray-200)", backgroundColor: "white" }}>
      {/* Quick reply chips */}
      {showChips && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              disabled={disabled}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:text-white disabled:opacity-50"
              style={{
                borderColor: "var(--rtg-blue)",
                color: "var(--rtg-blue)",
                backgroundColor: "white",
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = "var(--rtg-blue)";
                  e.currentTarget.style.color = "white";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "white";
                e.currentTarget.style.color = "var(--rtg-blue)";
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about mattresses..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl px-4 py-2.5 text-[15px] leading-relaxed placeholder:text-gray-400 disabled:opacity-50"
          style={{
            border: "1px solid var(--rtg-gray-200)",
            color: "var(--rtg-charcoal)",
            backgroundColor: "var(--rtg-gray-50)",
            maxHeight: 100,
            outline: "none",
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 100) + "px";
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40"
          style={{
            backgroundColor: disabled || !input.trim()
              ? "var(--rtg-gray-200)"
              : "var(--rtg-blue)",
          }}
          aria-label="Send message"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
