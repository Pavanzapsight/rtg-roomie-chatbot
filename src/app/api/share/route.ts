import { putShare } from "@/lib/share-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Sanitize: only keep role + text
    const cleaned = messages
      .filter((m: unknown): m is { role: string; text: string } =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as { role?: unknown }).role === "string" &&
        typeof (m as { text?: unknown }).text === "string"
      )
      .slice(-100);

    if (cleaned.length === 0) {
      return new Response(JSON.stringify({ error: "No valid messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const id = putShare(cleaned);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
