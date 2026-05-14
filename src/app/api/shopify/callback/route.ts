import { NextRequest, NextResponse } from "next/server";
import {
  exchangeShopifyCodeForAccessToken,
  fetchShopifyShopDetails,
  getShopifyAppConfig,
  normalizeShopifyShopDomain,
  verifyShopifyCallbackHmac,
  verifyShopifyInstallState,
} from "@/lib/shopify";
import { upsertTenantFromShopifyInstall } from "@/lib/tenant-platform";

const SHOPIFY_INSTALL_COOKIE = "rtg_shopify_install_state";

export async function GET(request: NextRequest) {
  try {
    const config = getShopifyAppConfig(request.nextUrl.origin);
    const shop = normalizeShopifyShopDomain(request.nextUrl.searchParams.get("shop"));
    const code = String(request.nextUrl.searchParams.get("code") || "").trim();
    const state = String(request.nextUrl.searchParams.get("state") || "").trim();
    const cookieState = request.cookies.get(SHOPIFY_INSTALL_COOKIE)?.value;

    if (!shop || !code || !state) {
      return Response.json({ error: "Shopify callback is missing required parameters." }, { status: 400 });
    }

    if (!verifyShopifyCallbackHmac(request.nextUrl.searchParams, config.apiSecret)) {
      return Response.json({ error: "Invalid Shopify callback signature." }, { status: 401 });
    }

    const verifiedState = verifyShopifyInstallState(state, config.apiSecret);
    const cookieMatches = !cookieState || cookieState === state;
    if (!verifiedState || verifiedState.shop !== shop || !cookieMatches) {
      return Response.json({ error: "Shopify install state validation failed." }, { status: 401 });
    }

    const token = await exchangeShopifyCodeForAccessToken({ shop, code, config });
    const shopDetails = await fetchShopifyShopDetails({
      shop,
      accessToken: token.accessToken,
      config,
    });

    const tenant = await upsertTenantFromShopifyInstall({
      shopDomain: shopDetails.myshopifyDomain,
      storefrontDomain: shopDetails.primaryDomainHost,
      accessToken: token.accessToken,
      scopes: token.scopes,
      shopName: shopDetails.name,
      shopOwner: shopDetails.shopOwner,
      email: shopDetails.email,
      currencyCode: shopDetails.currencyCode,
    });

    const response = NextResponse.redirect(
      new URL(
        `/shopify/installed?shop=${encodeURIComponent(shop)}&tenantKey=${encodeURIComponent(tenant.tenantKey)}`,
        request.nextUrl.origin
      )
    );
    response.cookies.delete(SHOPIFY_INSTALL_COOKIE);
    return response;
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Shopify callback failed." },
      { status: 500 }
    );
  }
}
