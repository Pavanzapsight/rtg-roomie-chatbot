/**
 * Client-side complaint intent detection.
 *
 * We detect complaint signals in user messages so we can IMMEDIATELY suppress
 * all proactive triggers (upsell / interjection / contextual / re-engagement)
 * even before the server has a chance to respond with `[STAGE:complaint]`.
 *
 * This is a best-effort pattern-match — the authoritative complaint handling
 * is in skills/complaint.md, driven by the AI via the stage tag. The
 * detection here is purely defensive: ensure no proactive message fires on
 * top of a customer who just said "I want to return this."
 */

import { detectStageFromResponse } from "./stage-tag";

/** Patterns that signal a customer is complaining, returning, or upset. */
const COMPLAINT_PATTERNS: ReadonlyArray<RegExp> = [
  // Return / refund / exchange intent
  /\b(want to |need to |how (do|can) i |i want a |give me a )?return(ing|ed)?\b/i,
  /\brefund(ed|ing)?\b/i,
  /\bexchange\b/i,
  /\bsend it back\b/i,
  /\bsend them back\b/i,
  /\bget my money back\b/i,
  // Defect / malfunction language
  /\bbroken\b/i,
  /\bdefective\b/i,
  /\bfaulty\b/i,
  /\bsagging\b/i,
  /\bsag\b/i,
  /\bdamaged\b/i,
  /\bnot working\b/i,
  /\bdoesn'?t work\b/i,
  /\bdon'?t work\b/i,
  /\bwon'?t work\b/i,
  /\bfell apart\b/i,
  // Warranty / complaint intent
  /\bwarranty (claim|coverage|issue)\b/i,
  /\bfile a (claim|complaint)\b/i,
  /\bcomplaint\b/i,
  // Strong frustration — always escalate
  /\b(terrible|horrible|awful|worst)\b/i,
  /\bfurious\b/i,
  /\bunacceptable\b/i,
  /\blawsuit\b/i,
  /\b(bbb|better business bureau)\b/i,
  // Ownership + problem (owning the product and there's an issue)
  /\bmy (mattress|bed|base|frame)( is| has)? (too|feel|sag|sink|broke|hurt|pain|terrible|awful|bad)/i,
  /\bthe (mattress|bed) i (bought|ordered|got|have)\b/i,
  // Delivery/service complaints
  /\b(delivery|driver|associate|salesperson)\b.*(late|rude|missed|wrong|never)/i,
  /\b(late|rude|missed|wrong|never).*\b(delivery|driver|associate|salesperson)\b/i,
  // Billing
  /\b(double|wrong|incorrect) charge(d)?\b/i,
  /\bbilling (issue|problem|error)\b/i,
  /\bovercharged\b/i,
];

/**
 * Returns true if the given text looks like a complaint / return / support
 * request from the customer. Case-insensitive; word-boundary based.
 */
export function isComplaintMessage(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return COMPLAINT_PATTERNS.some((re) => re.test(text));
}

/**
 * Determines whether the conversation is currently in "complaint mode" based
 * on the recent message history.
 *
 * Rules:
 *  - If the most recent user message matches a complaint pattern → true
 *  - If the most recent assistant message has `[STAGE:complaint]` tag → true
 *  - Otherwise → false
 *
 * The consumer (ChatWidget's gatedFire) uses this to suppress proactive
 * triggers so the customer isn't interrupted mid-complaint with an upsell
 * or contextual nudge.
 */
export function isInComplaintMode(
  messages: ReadonlyArray<{ role: string; text: string }>
): boolean {
  if (!messages || messages.length === 0) return false;

  // Walk backwards — most-recent first
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") {
      // Complaint signals in the user's latest message override everything
      if (isComplaintMessage(msg.text)) return true;
      // If the last user message is NOT a complaint and there's no newer
      // assistant message in complaint stage, we're not in complaint mode.
      // (They may have moved on to a shopping question.)
      // Continue scanning backwards in case we already tagged a recent
      // assistant response as complaint and the user hasn't replied yet.
      continue;
    }
    if (msg.role === "assistant") {
      const stage = detectStageFromResponse(msg.text);
      if (stage === "complaint") return true;
      // If we hit a non-complaint persistent assistant stage before finding
      // evidence of complaint mode, we're not in it. Transient stages
      // (contextual / reengagement / interjection / new-session / upsell)
      // don't clear complaint mode — they can fire within complaint mode
      // and get suppressed; the persistent chat stages DO clear it.
      if (
        stage &&
        stage !== "contextual" &&
        stage !== "reengagement" &&
        stage !== "interjection" &&
        stage !== "new-session" &&
        stage !== "upsell"
      ) {
        return false;
      }
      continue;
    }
  }
  return false;
}
