import { createShareLink, resolveTenantFromToken } from "@/lib/tenant-platform";
import type { SharedChatMessage } from "@/lib/chat-types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body?.messages;
    const tenantKey = typeof body?.tenantKey === "string" ? body.tenantKey : "";
    const tenantToken = request.headers.get("x-tenant-token");

    if (!tenantKey) {
      return new Response(JSON.stringify({ error: "Missing tenantKey" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Sanitize: only keep role + text
    const cleaned = messages
      .filter((m: unknown): m is SharedChatMessage =>
        typeof m === "object" &&
        m !== null &&
        ((m as { role?: unknown }).role === "user" ||
          (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { text?: unknown }).text === "string"
      )
      .slice(-100);

    if (cleaned.length === 0) {
      return new Response(JSON.stringify({ error: "No valid messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tenant = await resolveTenantFromToken(tenantKey, tenantToken);
    const id = await createShareLink({
      tenantId: tenant.tenantId,
      messages: cleaned,
    });
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
