import { spawn } from "child_process";
import {
  buildSystemPrompt,
  type ConversationStage,
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
  type?: "chat" | "proactive";
  pageContext?: PageContext;
}

// Extract stage tag from response text
const STAGE_REGEX =
  /\[STAGE:(proactive|greeting|discovery|recommendation|comparison|closing)\]\s*$/;

function detectStageFromResponse(text: string): ConversationStage | null {
  const match = text.match(STAGE_REGEX);
  return match ? (match[1] as ConversationStage) : null;
}

function stripStageTag(text: string): string {
  return text.replace(STAGE_REGEX, "").trimEnd();
}

// Infer current stage from conversation history
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
  userPrompt: string,
  currentStage: ConversationStage
): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let accumulatedText = "";

      const proc = spawn(
        "claude",
        [
          "-p",
          "--model",
          "sonnet",
          "--system-prompt",
          systemPrompt,
          "--output-format",
          "stream-json",
          "--verbose",
          "--include-partial-messages",
          "--no-session-persistence",
          userPrompt,
        ],
        {
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: "",
          },
        }
      );

      let buffer = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (
              event.type === "stream_event" &&
              event.event?.type === "content_block_delta" &&
              event.event.delta?.type === "text_delta"
            ) {
              const delta = event.event.delta.text;
              accumulatedText += delta;
              const display = stripStageTag(accumulatedText);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ delta: true, text: display })}\n\n`
                )
              );
            }

            if (event.type === "result" && event.result) {
              const resultText = stripStageTag(event.result);
              const nextStage = detectStageFromResponse(event.result);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    done: true,
                    text: resultText,
                    stage: nextStage || currentStage,
                  })}\n\n`
                )
              );
            }
          } catch {
            // Not valid JSON, skip
          }
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        console.error("[claude stderr]:", chunk.toString());
      });

      proc.on("close", () => {
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            if (event.type === "result" && event.result) {
              const resultText = stripStageTag(event.result);
              const nextStage = detectStageFromResponse(event.result);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    done: true,
                    text: resultText,
                    stage: nextStage || currentStage,
                  })}\n\n`
                )
              );
            }
          } catch {
            // skip
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });

      proc.on("error", (err) => {
        console.error("[claude error]:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Failed to connect to Claude" })}\n\n`
          )
        );
        controller.close();
      });
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
  const { messages, type, pageContext } = body;

  const catalogData = getCatalogData();

  // Proactive interjection — no prior conversation
  if (type === "proactive" && pageContext) {
    const systemPrompt = buildSystemPrompt(catalogData, "proactive", pageContext);
    const userPrompt = `Generate a proactive interjection message for this page context: ${JSON.stringify(pageContext)}`;
    return buildStreamResponse(systemPrompt, userPrompt, "proactive");
  }

  // Normal chat flow
  const currentStage = inferStage(messages);
  const systemPrompt = buildSystemPrompt(catalogData, currentStage);

  const conversationParts: string[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      conversationParts.push(`User: ${msg.text}`);
    } else if (msg.role === "assistant" && msg.id !== "welcome") {
      conversationParts.push(`Assistant: ${stripStageTag(msg.text)}`);
    }
  }

  const userPrompt = conversationParts.join("\n\n");
  return buildStreamResponse(systemPrompt, userPrompt, currentStage);
}
