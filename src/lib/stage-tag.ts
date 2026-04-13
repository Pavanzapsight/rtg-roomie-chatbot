import type { ConversationStage } from "./system-prompt";

export const STAGE_REGEX =
  /\[STAGE:(proactive|returning|greeting|discovery|recommendation|comparison|closing)\]\s*$/;

export function detectStageFromResponse(text: string): ConversationStage | null {
  const match = text.match(STAGE_REGEX);
  return match ? (match[1] as ConversationStage) : null;
}

export function stripStageTag(text: string): string {
  return text.replace(STAGE_REGEX, "").trimEnd();
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
