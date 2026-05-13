import { NextRequest } from "next/server";
import { getPublicWidgetConfigByDomain } from "@/lib/tenant-platform";

function normalizeHostname(input: string | null | undefined): string {
  const value = String(input || "").trim().toLowerCase();
  if (!value) return "";

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

export async function GET(request: NextRequest) {
  try {
    const hostname = normalizeHostname(request.nextUrl.searchParams.get("shop"));
    if (!hostname) {
      return Response.json({ error: "shop is required." }, { status: 400 });
    }

    const config = await getPublicWidgetConfigByDomain(hostname);
    if (!config) {
      return Response.json({ error: "No tenant found for this shop domain." }, { status: 404 });
    }

    return Response.json(config, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load widget config." },
      { status: 500 }
    );
  }
}
