import {
  buildSystemPrompt,
  type ConversationStage,
  type VisitorProfile,
  type PageContext,
} from "@/lib/system-prompt";
import { getCatalogData } from "@/lib/catalog";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  type?: "chat" | "proactive" | "returning";
  pageContext?: PageContext;
  visitorProfile?: VisitorProfile;
  model?: string;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_MAP: Record<string, string> = {
  "gemini-flash-3": "google/gemini-2.5-flash",
  "claude-sonnet-4.6": "anthropic/claude-sonnet-4-20250514",
  "gpt-5.4": "openai/gpt-4.1",
};

const DEFAULT_MODEL = "claude-sonnet-4.6";

// Extract stage tag from response text
const STAGE_REGEX =
  /\[STAGE:(proactive|returning|greeting|discovery|recommendation|comparison|closing)\]\s*$/;

function detectStageFromResponse(text: string): ConversationStage | null {
  const match = text.match(STAGE_REGEX);
  return match ? (match[1] as ConversationStage) : null;
}

function stripStageTag(text: string): string {
  return text.replace(STAGE_REGEX, "").trimEnd();
}

function inferStage(messages: ChatMessage[]): ConversationStage {
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

function buildStreamResponse(
  systemPrompt: string,
  chatMessages: { role: string; content: string }[],
  currentStage: ConversationStage,
  modelKey: string
): Response {
  const modelId = MODEL_MAP[modelKey] || MODEL_MAP[DEFAULT_MODEL];
  const apiKey = process.env.OPENROUTER_API_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://roomstogo.com",
            "X-Title": "Roomie Mattress Advisor",
          },
          body: JSON.stringify({
            model: modelId,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              ...chatMessages,
            ],
          }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "Unknown error");
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: `API error (${res.status}): ${errText}` })}\n\n`
            )
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);
              const delta = event.choices?.[0]?.delta?.content;
              if (delta) {
                accumulatedText += delta;
                const display = stripStageTag(accumulatedText);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ delta: true, text: display })}\n\n`
                  )
                );
              }
            } catch {
              // Skip unparseable
            }
          }
        }

        // Send final result
        const finalText = stripStageTag(accumulatedText);
        const nextStage = detectStageFromResponse(accumulatedText);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              done: true,
              text: finalText,
              stage: nextStage || currentStage,
            })}\n\n`
          )
        );
      } catch (err) {
        console.error("[openrouter error]:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Failed to connect to AI provider" })}\n\n`
          )
        );
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  const body: ChatRequest = await request.json();
  const { messages, type, pageContext, visitorProfile, model } = body;

  const catalogData = getCatalogData();
  const modelKey = model || DEFAULT_MODEL;

  // Proactive interjection
  if (type === "proactive" && pageContext) {
    const systemPrompt = buildSystemPrompt(catalogData, "proactive", {
      pageContext,
    });
    return buildStreamResponse(
      systemPrompt,
      [
        {
          role: "user",
          content: `Generate a proactive interjection for: ${JSON.stringify(pageContext)}`,
        },
      ],
      "proactive",
      modelKey
    );
  }

  // Returning visitor
  if (type === "returning" && visitorProfile) {
    const systemPrompt = buildSystemPrompt(catalogData, "returning", {
      visitorProfile,
    });
    return buildStreamResponse(
      systemPrompt,
      [
        {
          role: "user",
          content: `Generate a returning visitor greeting for: ${JSON.stringify(visitorProfile)}`,
        },
      ],
      "returning",
      modelKey
    );
  }

  // Normal chat flow
  const currentStage = inferStage(messages);
  const systemPrompt = buildSystemPrompt(catalogData, currentStage, {
    visitorProfile: visitorProfile || undefined,
  });

  // Build OpenAI-format messages
  const chatMessages: { role: string; content: string }[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      chatMessages.push({ role: "user", content: msg.text });
    } else if (msg.role === "assistant" && msg.id !== "welcome") {
      chatMessages.push({
        role: "assistant",
        content: stripStageTag(msg.text),
      });
    }
  }

  return buildStreamResponse(systemPrompt, chatMessages, currentStage, modelKey);
}
