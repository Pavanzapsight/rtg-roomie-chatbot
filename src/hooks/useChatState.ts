/**
 * useChatState — a computed view of the chatbot's current high-level state.
 *
 * This is a reflection of reality (derived from other refs/state), NOT the
 * driver of behavior. The triggers and timers still own their own logic.
 * The enum exists so we have one name for "what's happening right now" —
 * useful for logging, analytics, and reasoning about interactions.
 *
 * State transitions (matching the product spec):
 *
 *   Any state
 *       → user types in chat → CONVERSATION  (proactive timers/counters clear)
 *   CONVERSATION
 *       → idle 20 min → IDLE
 *       → browses with chat open → BROWSING_CHAT_OPEN
 *       → closes chat → BROWSING_CHAT_CLOSED
 *   BROWSING_CHAT_CLOSED
 *       → opens chat → BROWSING_CHAT_OPEN
 *   All tabs closed → next open → NEW_SESSION
 */
"use client";

import { useMemo } from "react";

export type ChatState =
  | "NEW_SESSION"
  | "CONVERSATION"
  | "BROWSING_CHAT_OPEN"
  | "BROWSING_CHAT_CLOSED"
  | "IDLE"
  | "HUMAN_MODE";

export interface UseChatStateArgs {
  isOpen: boolean;
  humanMode: boolean;
  isNewSessionPhase: boolean; // true right after a NEW_SESSION greeting, clears on first user msg
  isIdle: boolean;
  msSinceLastUserMessage: number | null; // null = no user msgs yet
}

export const CONVERSATION_WINDOW_MS = 30_000;

export function useChatState({
  isOpen,
  humanMode,
  isNewSessionPhase,
  isIdle,
  msSinceLastUserMessage,
}: UseChatStateArgs): ChatState {
  return useMemo(() => {
    if (humanMode) return "HUMAN_MODE";
    if (isIdle && isOpen) return "IDLE";

    // If user messaged recently → CONVERSATION (takes precedence over browsing)
    if (
      msSinceLastUserMessage != null &&
      msSinceLastUserMessage < CONVERSATION_WINDOW_MS
    ) {
      return "CONVERSATION";
    }

    if (isNewSessionPhase && msSinceLastUserMessage == null) return "NEW_SESSION";

    return isOpen ? "BROWSING_CHAT_OPEN" : "BROWSING_CHAT_CLOSED";
  }, [isOpen, humanMode, isNewSessionPhase, isIdle, msSinceLastUserMessage]);
}
