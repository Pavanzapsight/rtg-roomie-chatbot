import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  buildSystemPrompt,
  type VisitorProfile,
  type PageContext,
  type BrowsingHistoryEntry,
  type ConversationStage,
} from "@/lib/system-prompt";
import { getCatalogData, getAccessoryData } from "@/lib/catalog";
import { inferStage, stripStageTag } from "@/lib/stage-tag";
import { isComplaintMessage } from "@/lib/complaint-detection";

export const maxDuration = 60;

type ChatRequestBody = {
  id?: string;
  messages: UIMessage[];
  type?: "chat" | "returning" | "summarize" | "reengagement" | "contextual" | "new-session" | "interjection" | "upsell";
  interjectionType?: "compare" | "inform" | "guide" | "social" | "resume";
  pageContext?: PageContext;
  browsingHistory?: BrowsingHistoryEntry[];
  visitorProfile?: VisitorProfile;
  model?: string;
};

const MODEL_MAP: Record<string, string> = {
  "gemini-flash-3": "google/gemini-3-flash-preview",
  "claude-sonnet-4.6": "anthropic/claude-sonnet-4.6",
  "gpt-5.4": "openai/gpt-5.4",
};

const DEFAULT_MODEL = "gemini-flash-3";

function getTextFromUiMessage(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function sanitizeForModel(messages: UIMessage[]): Omit<UIMessage, "id">[] {
  return messages
    .filter((m) => m.id !== "welcome")
    .map((m) => {
      const { id: _id, ...rest } = m;
      if (m.role !== "assistant") return rest as Omit<UIMessage, "id">;
      return {
        ...rest,
        parts: rest.parts.map((p) =>
          p.type === "text" ? { ...p, text: stripStageTag(p.text) } : p
        ),
      } as Omit<UIMessage, "id">;
    });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing OPENROUTER_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = (await request.json()) as ChatRequestBody;
  const { messages = [], type, pageContext: rawPageContext, browsingHistory, visitorProfile, model, interjectionType } = body;

  // Merge browsing history into page context so it reaches the system prompt
  const pageContext: PageContext | undefined = rawPageContext
    ? { ...rawPageContext, browsingHistory: browsingHistory || rawPageContext.browsingHistory }
    : undefined;

  const catalogData = getCatalogData();
  const modelKey = model || DEFAULT_MODEL;
  const modelId = MODEL_MAP[modelKey] ?? MODEL_MAP[DEFAULT_MODEL];

  const openrouter = createOpenRouter({
    apiKey,
    appName: "Roomie Mattress Advisor",
    appUrl: "https://roomstogo.com",
  });

  try {
    if (type === "summarize" && messages.length > 0) {
      const result = streamText({
        model: openrouter.chat(modelId),
        system: "You are a helpful assistant. Complete this phrase naturally in under 15 words, describing what the customer was looking for based on the conversation: 'looking for...'. Start directly with 'looking for' and end with a period. Do not include any preamble.",
        messages: [
          {
            role: "user",
            content: `Summarize this conversation:\n${messages
              .filter((m) => m.id !== "welcome")
              .map((m) => `${m.role}: ${m.parts.filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("")}`)
              .join("\n")}`,
          },
        ],
      });
      return result.toUIMessageStreamResponse({
        onError: () => "Something went wrong.",
      });
    }

    if (type === "returning" && visitorProfile) {
      const systemPrompt = buildSystemPrompt(catalogData, "returning", {
        visitorProfile,
        pageContext: pageContext ?? undefined,
      });
      // Include prior chat history (if any) so the AI can reference the
      // last topic. Always append a trigger message so the AI generates
      // (an assistant-ended history alone would produce empty output).
      const sanitized = sanitizeForModel(messages);
      const modelMessages = await convertToModelMessages(sanitized);
      const result = streamText({
        model: openrouter.chat(modelId),
        system: systemPrompt,
        messages: [
          ...modelMessages,
          {
            role: "user",
            content: `Generate a welcome-back greeting NOW following the returning skill. ${modelMessages.length > 0 ? "Reference one concrete detail from the chat history above." : "The visitor has no prior chat history this session but has visited the site before."} Visitor profile: ${JSON.stringify(visitorProfile)}`,
          },
        ],
      });
      return result.toUIMessageStreamResponse({
        onError: () => "Something went wrong.",
      });
    }

    // State 1: Re-engagement after 20min idle. Uses full chat history for the
    // summary, plus the reengagement skill for phrasing.
    if (type === "reengagement") {
      const systemPrompt = buildSystemPrompt(catalogData, "reengagement", {
        visitorProfile: visitorProfile ?? undefined,
        pageContext: pageContext ?? undefined,
      });
      const sanitized = sanitizeForModel(messages);
      const modelMessages = await convertToModelMessages(sanitized);
      // Always append a trigger so the AI generates something — existing
      // history alone ends with an assistant turn and produces empty output.
      const result = streamText({
        model: openrouter.chat(modelId),
        system: systemPrompt,
        messages: [
          ...modelMessages,
          {
            role: "user",
            content: "The customer is back after 20 minutes of idle. Generate the re-engagement message now, following the reengagement skill.",
          },
        ],
      });
      return result.toUIMessageStreamResponse({
        onError: () => "Something went wrong.",
      });
    }

    // State 2: Contextual product commentary (chat open, navigated to PDP,
    // dwelled 5+ seconds, not within cooldown). Uses the contextual skill.
    if (type === "contextual" && pageContext) {
      const systemPrompt = buildSystemPrompt(catalogData, "contextual", {
        visitorProfile: visitorProfile ?? undefined,
        pageContext,
      });
      const sanitized = sanitizeForModel(messages);
      const modelMessages = await convertToModelMessages(sanitized);
      const result = streamText({
        model: openrouter.chat(modelId),
        system: systemPrompt,
        messages: [
          ...modelMessages,
          {
            role: "user",
            content: `The customer just landed on the product page for "${pageContext.productName || "a product"}"${pageContext.productPrice ? ` (${pageContext.productPrice})` : ""}. Generate the contextual commentary NOW, following the contextual skill. Keep it under 25 words.`,
          },
        ],
      });
      return result.toUIMessageStreamResponse({
        onError: () => "Something went wrong.",
      });
    }

    // State 4: first-time-visitor greeting (no prior chat history). Uses the
    // new-session skill which is light — intro + stand by for user input.
    if (type === "new-session") {
      const systemPrompt = buildSystemPrompt(catalogData, "new-session", {
        visitorProfile: visitorProfile ?? undefined,
        pageContext: pageContext ?? undefined,
      });
      const result = streamText({
        model: openrouter.chat(modelId),
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: "The customer just arrived on the site for a fresh session (no chat history). Generate the one-time greeting.",
          },
        ],
      });
      return result.toUIMessageStreamResponse({
        onError: () => "Something went wrong.",
      });
    }

    // State 3: BROWSING_CHAT_CLOSED interjection. Subtype tells the skill
    // which sub-template to use (compare/inform/guide/social/resume).
    if (type === "interjection" && interjectionType) {
      const systemPrompt = buildSystemPrompt(catalogData, "interjection", {
        visitorProfile: visitorProfile ?? undefined,
        pageContext: pageContext ?? undefined,
        interjectionType,
      });
      const sanitized = sanitizeForModel(messages);
      const modelMessages = await convertToModelMessages(sanitized);
      const result = streamText({
        model: openrouter.chat(modelId),
        system: systemPrompt,
        messages: [
          ...modelMessages,
          {
            role: "user",
            content: `Generate an interjection of type "${interjectionType}" NOW, following the interjection skill's "${interjectionType}" sub-template. The customer has been browsing with the chat closed.

IMPORTANT context to weave in:
- Scan the full chat history above for prior preferences, questions, or pain points the customer mentioned (sleep position, temperature, budget, back pain, partner, etc.). Reference one concrete detail if present.
- Scan the BROWSING HISTORY section of your system prompt for specific products the customer has viewed during this session. Name the most-relevant one explicitly if it fits the interjection type (especially "compare", "inform", "social", "resume").
- Scan the SHOPIFY CART STATUS section for what's already in the cart. NEVER re-suggest what they already have.
- Avoid repeating any category or phrasing you've used in a prior [STAGE:interjection] message in this conversation.`,
          },
        ],
      });
      return result.toUIMessageStreamResponse({
        onError: () => "Something went wrong.",
      });
    }

    // Post-Add-to-Cart cross-sell. Fires after a successful cart action.
    // Uses the upsell skill — one short suggestion + tiles. Capped at 2
    // invocations per session by the client.
    if (type === "upsell") {
      const systemPrompt = buildSystemPrompt(catalogData, "upsell", {
        visitorProfile: visitorProfile ?? undefined,
        pageContext: pageContext ?? undefined,
      });
      const sanitized = sanitizeForModel(messages);
      const modelMessages = await convertToModelMessages(sanitized);

      // Build an explicit exclusion list so the AI can't blindly suggest
      // an accessory the customer already has.
      const cartList = pageContext?.cartItems && pageContext.cartItems.length > 0
        ? pageContext.cartItems.join("; ")
        : "";
      const exclusionLine = cartList
        ? `\n\nThe cart already contains: ${cartList}. Do NOT suggest any of these items — pick a DIFFERENT complementary category.`
        : "";

      // Also tell the AI to scan prior assistant messages with [STAGE:upsell]
      // in this conversation and avoid repeating those categories.
      const repeatLine = `\n\nScan your previous assistant messages in this conversation. If you've already suggested a mattress protector, pick a frame / adjustable base / pillow instead. If you've already suggested a frame, pick a pillow / protector / base. Never repeat the same category twice in the same session.`;

      const result = streamText({
        model: openrouter.chat(modelId),
        system: systemPrompt,
        messages: [
          ...modelMessages,
          {
            role: "user",
            content: `The customer just added ${pageContext?.productName || "a mattress"} to their cart. Generate ONE short cross-sell suggestion NOW, following the upsell skill. Pick the single best complementary item based on the chat history and current product.${exclusionLine}${repeatLine}`,
          },
        ],
      });
      return result.toUIMessageStreamResponse({
        onError: () => "Something went wrong.",
      });
    }

    const plainForStage = messages.map((m) => ({
      role: m.role,
      text: getTextFromUiMessage(m),
    }));

    // Complaint override: if the user's latest message contains complaint
    // signals (return / defect / refund / strong frustration), force the
    // complaint stage so skills/complaint.md loads immediately — don't
    // wait for the AI to self-route via the system prompt's override. This
    // prevents a turn of "recommendation" or "discovery" behavior firing
    // on top of a complaint message.
    const lastUser = [...plainForStage].reverse().find((m) => m.role === "user");
    const userSaidComplaint = lastUser ? isComplaintMessage(lastUser.text) : false;
    const currentStage: ConversationStage = userSaidComplaint
      ? "complaint"
      : inferStage(plainForStage);
    const systemPrompt = buildSystemPrompt(catalogData, currentStage, {
      visitorProfile: visitorProfile ?? undefined,
      pageContext: pageContext ?? undefined,
      accessoryData: currentStage === "closing" ? getAccessoryData() : undefined,
    });

    const sanitized = sanitizeForModel(messages);
    const modelMessages = await convertToModelMessages(sanitized);

    const result = streamText({
      model: openrouter.chat(modelId),
      system: systemPrompt,
      messages: modelMessages,
    });
    return result.toUIMessageStreamResponse({
      onError: () => "Something went wrong.",
    });
  } catch (err) {
    console.error("[chat route]:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Chat request failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
