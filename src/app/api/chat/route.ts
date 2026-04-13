import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  buildSystemPrompt,
  type VisitorProfile,
  type PageContext,
} from "@/lib/system-prompt";
import { getCatalogData } from "@/lib/catalog";
import { inferStage, stripStageTag } from "@/lib/stage-tag";

export const maxDuration = 60;

type ChatRequestBody = {
  id?: string;
  messages: UIMessage[];
  type?: "chat" | "proactive" | "returning";
  pageContext?: PageContext;
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
  const { messages = [], type, pageContext, visitorProfile, model } = body;

  const catalogData = getCatalogData();
  const modelKey = model || DEFAULT_MODEL;
  const modelId = MODEL_MAP[modelKey] ?? MODEL_MAP[DEFAULT_MODEL];

  const openrouter = createOpenRouter({
    apiKey,
    appName: "Roomie Mattress Advisor",
    appUrl: "https://roomstogo.com",
  });

  try {
    if (type === "proactive" && pageContext) {
      const systemPrompt = buildSystemPrompt(catalogData, "proactive", {
        pageContext,
      });
      const result = streamText({
        model: openrouter.chat(modelId),
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Generate a proactive interjection for: ${JSON.stringify(pageContext)}`,
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
      });
      const result = streamText({
        model: openrouter.chat(modelId),
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Generate a returning visitor greeting for: ${JSON.stringify(visitorProfile)}`,
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
    const currentStage = inferStage(plainForStage);
    const systemPrompt = buildSystemPrompt(catalogData, currentStage, {
      visitorProfile: visitorProfile ?? undefined,
      pageContext: pageContext ?? undefined,
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
