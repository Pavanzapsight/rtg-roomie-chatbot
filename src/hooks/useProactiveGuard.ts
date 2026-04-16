/**
 * useProactiveGuard — single source of truth for whether the chat can emit
 * another proactive message right now.
 *
 * Enforces the global constraints:
 *  - Never interrupt cart/checkout
 *  - Never stack (15s debounce between any two proactive messages)
 *  - Never interrupt an active conversation (30s cooldown after a user msg)
 *  - Never speak over a streaming response (isStreaming lock)
 *  - Never speak while a human agent (Joan) is engaged
 *
 * Every proactive trigger (State 1 re-engagement, State 2 contextual, State
 * 3 interjection, State 4 greeting) routes through `canFire()`. On success,
 * call `markFired()` so the debounce ticker starts.
 */
"use client";

import { useCallback, useRef } from "react";
import type { PageContext } from "@/lib/system-prompt";

export const PROACTIVE_DEBOUNCE_MS = 15_000;
export const USER_MSG_COOLDOWN_MS = 20_000;

export type ProactiveReason =
  | "new-session"
  | "interjection"
  | "contextual"
  | "reengagement"
  | "upsell";

export interface CanFireOptions {
  /** Bypass the 15s stack-debounce. Use for event-driven triggers like
   *  post-Add-to-Cart upsell, which respond to an explicit user commitment
   *  and shouldn't be swallowed just because another proactive fired
   *  moments earlier. */
  bypassDebounce?: boolean;
}

export interface ProactiveGuardResult {
  allowed: boolean;
  reason?: string; // human-readable reason for skip (for debugging / logs)
}

export interface UseProactiveGuardArgs {
  isStreaming: boolean;
  humanMode: boolean;
}

export function useProactiveGuard({
  isStreaming,
  humanMode,
}: UseProactiveGuardArgs) {
  const lastProactiveAtRef = useRef<number>(0);
  const lastUserActivityAtRef = useRef<number>(0);

  /** Check if firing a proactive message is currently allowed. */
  const canFire = useCallback(
    (
      which: ProactiveReason,
      ctx: PageContext | null,
      options: CanFireOptions = {}
    ): ProactiveGuardResult => {
      if (humanMode) return { allowed: false, reason: "human-mode" };
      if (isStreaming) return { allowed: false, reason: "streaming" };

      // Rule: Never on cart/checkout — both page context and URL path
      if (ctx?.page === "cart") return { allowed: false, reason: "cart-page" };
      if (typeof window !== "undefined") {
        const path = window.location.pathname || "";
        if (/^\/cart(\/|$)/.test(path)) return { allowed: false, reason: "cart-path" };
        if (/\/checkouts?\//.test(path)) return { allowed: false, reason: "checkout-path" };
        if (/\/checkout($|\/)/.test(path)) return { allowed: false, reason: "checkout-path" };
      }

      // Rule: Never stack — debounce 15s since last proactive
      // (upsell opts out: it's an event-driven response to Add-to-Cart,
      //  not an unsolicited interruption)
      const now = Date.now();
      if (!options.bypassDebounce) {
        if (now - lastProactiveAtRef.current < PROACTIVE_DEBOUNCE_MS) {
          return { allowed: false, reason: "stack-debounce" };
        }
      }

      // Rule: Don't interrupt active conversation — 30s after user msg
      if (now - lastUserActivityAtRef.current < USER_MSG_COOLDOWN_MS) {
        // new-session and upsell get a pass (event-driven, not periodic)
        if (which !== "new-session" && which !== "upsell") {
          return { allowed: false, reason: "conversation-cooldown" };
        }
      }

      return { allowed: true };
    },
    [humanMode, isStreaming]
  );

  /** Mark that a proactive message was just fired. */
  const markFired = useCallback(() => {
    lastProactiveAtRef.current = Date.now();
  }, []);

  /** Mark that the user just sent or is actively composing a message. */
  const markUserActivity = useCallback(() => {
    lastUserActivityAtRef.current = Date.now();
  }, []);

  return {
    canFire,
    markFired,
    markUserActivity,
  };
}
