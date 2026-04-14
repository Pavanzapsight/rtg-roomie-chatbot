import type { ConversationStage } from "./system-prompt";

const STAGE_NAMES = "(proactive|returning|greeting|discovery|recommendation|comparison|closing)";

// Anchored version used for detection (must be at end of response)
export const STAGE_REGEX = new RegExp(`\\[STAGE:${STAGE_NAMES}\\]\\s*$`);

// Global version used for stripping — catches the tag anywhere in the text
const STAGE_REGEX_GLOBAL = new RegExp(`\\[STAGE:${STAGE_NAMES}\\]\\s*`, "g");

export function detectStageFromResponse(text: string): ConversationStage | null {
  const match = text.match(STAGE_REGEX);
  return match ? (match[1] as ConversationStage) : null;
}

export function stripStageTag(text: string): string {
  return text.replace(STAGE_REGEX_GLOBAL, "").trimEnd();
}

export function inferStage(
  messages: { role: string; text: string }[]
): ConversationStage {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const stage = detectStageFromResponse(msg.text);
      if (stage) return stage;
    }
  }
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "greeting";
  if (userMessages.length === 1) return "discovery";
  return "discovery";
}
