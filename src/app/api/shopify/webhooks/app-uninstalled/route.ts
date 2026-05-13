import { NextRequest } from "next/server";
import {
  getShopifyAppConfig,
  normalizeShopifyShopDomain,
  verifyShopifyWebhookSignature,
} from "@/lib/shopify";
import { markShopifyInstallationUninstalled } from "@/lib/tenant-platform";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  try {
    const config = getShopifyAppConfig(request.nextUrl.origin);
    const isValid = verifyShopifyWebhookSignature({
      rawBody,
      hmacHeader: request.headers.get("x-shopify-hmac-sha256"),
      secret: config.apiSecret,
    });
    if (!isValid) {
      return Response.json({ error: "Invalid Shopify webhook signature." }, { status: 401 });
    }

    const shop = normalizeShopifyShopDomain(request.headers.get("x-shopify-shop-domain"));
    if (!shop) {
      return Response.json({ error: "Missing Shopify shop domain." }, { status: 400 });
    }

    await markShopifyInstallationUninstalled(shop);
    return new Response(null, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to process Shopify uninstall webhook." },
      { status: 500 }
    );
  }
}
