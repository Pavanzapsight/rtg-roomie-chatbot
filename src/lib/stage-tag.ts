import type { ConversationStage } from "./system-prompt";

const STAGE_NAMES = "(returning|greeting|discovery|recommendation|comparison|closing|reengagement|contextual|new-session|interjection)";

// Transient stages are one-shot proactive/system messages — they should NOT
// determine what skill loads on the next regular chat turn. After an
// interjection or contextual note, we want to fall back to the most recent
// *persistent* stage (or the default based on message count).
const TRANSIENT_STAGES: ReadonlySet<string> = new Set([
  "new-session",
  "interjection",
  "contextual",
  "reengagement",
]);

// Anchored version used for detection (must be at end of response).
// Tolerates optional whitespace after the colon and case variations.
export const STAGE_REGEX = new RegExp(`\\[STAGE:\\s*${STAGE_NAMES}\\s*\\]\\s*$`, "i");

// Global version used for stripping — catches the tag anywhere in the text
const STAGE_REGEX_GLOBAL = new RegExp(`\\[STAGE:\\s*${STAGE_NAMES}\\s*\\]\\s*`, "gi");

export function detectStageFromResponse(text: string): ConversationStage | null {
  const match = text.match(STAGE_REGEX);
  return match ? (match[1].toLowerCase() as ConversationStage) : null;
}

export function stripStageTag(text: string): string {
  return text.replace(STAGE_REGEX_GLOBAL, "").trimEnd();
}

export function inferStage(
  messages: { role: string; text: string }[]
): ConversationStage {
  // Walk backwards looking for the most recent PERSISTENT stage tag.
  // Transient stages (interjection/contextual/reengagement/new-session)
  // are skipped so a proactive message doesn't corrupt the next turn.
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const stage = detectStageFromResponse(msg.text);
    if (stage && !TRANSIENT_STAGES.has(stage)) return stage;
  }

  // Fallback based on user engagement
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "greeting";
  return "discovery";
}
