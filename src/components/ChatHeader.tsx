"use client";

export function ChatHeader({
  onMinimize,
  onClose,
  onRefresh,
}: {
  onMinimize: () => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <div
      className="flex h-16 shrink-0 items-center justify-between px-4"
      style={{ backgroundColor: "var(--rtg-red)" }}
    >
      <div className="flex items-center gap-3">
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
            Roomie — Mattress Advisor
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Refresh / New conversation */}
        <button
          onClick={onRefresh}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          aria-label="New conversation"
          title="New conversation"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
        {/* Minimize */}
        <button
          onClick={onMinimize}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          aria-label="Minimize chat"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <path d="M5 12h14" />
          </svg>
        </button>
        {/* Close */}
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          aria-label="Close chat"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
