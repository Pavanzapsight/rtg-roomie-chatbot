import Link from "next/link";

export default async function ShopifyInstalledPage({
  searchParams,
}: {
  searchParams?: Promise<{ shop?: string; tenantKey?: string }>;
}) {
  const params = (await (searchParams ?? Promise.resolve({}))) as {
    shop?: string;
    tenantKey?: string;
  };
  const shop = params.shop || "your Shopify store";
  const tenantKey = params.tenantKey || "";
  const shopifyApiKey = process.env.SHOPIFY_API_KEY?.trim() || "";
  const enableEmbedUrl =
    shopifyApiKey && shop && shop !== "your Shopify store"
      ? `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${encodeURIComponent(shopifyApiKey)}/roomie-chatbot`
      : "";

  return (
    <main className="min-h-screen px-6 py-10" style={{ background: "var(--widget-surface-alt)" }}>
      <div
        className="mx-auto max-w-3xl rounded-3xl border p-8"
        style={{ background: "var(--widget-surface)", borderColor: "var(--widget-border)" }}
      >
        <h1 className="text-3xl font-semibold" style={{ color: "var(--widget-text)" }}>
          Shopify install connected
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--widget-text-muted)" }}>
          {shop} is now linked to this app. The tenant was created or updated automatically, and the next step is wiring catalog sync plus the Theme App Embed storefront experience.
        </p>
        {enableEmbedUrl ? (
          <p className="mt-3 text-sm" style={{ color: "var(--widget-text-muted)" }}>
            Next, open the theme editor and enable the chatbot app embed for this store.
          </p>
        ) : null}
        <div className="mt-6 space-y-2 text-sm" style={{ color: "var(--widget-text-muted)" }}>
          <div>Shop: {shop}</div>
          <div>Tenant key: {tenantKey || "(created without a visible tenant key)"}</div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {enableEmbedUrl ? (
            <a
              href={enableEmbedUrl}
              className="rounded-2xl px-4 py-3 text-sm font-semibold"
              style={{ background: "var(--widget-accent)", color: "var(--widget-accent-text)" }}
            >
              Enable chatbot in theme editor
            </a>
          ) : null}
          <Link
            href="/admin"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold${enableEmbedUrl ? " border" : ""}`}
            style={
              enableEmbedUrl
                ? { borderColor: "var(--widget-border)", color: "var(--widget-text)" }
                : { background: "var(--widget-accent)", color: "var(--widget-accent-text)" }
            }
          >
            Open admin
          </Link>
          {tenantKey ? (
            <Link
              href={`/embed?tenantKey=${encodeURIComponent(tenantKey)}`}
              className="rounded-2xl border px-4 py-3 text-sm font-semibold"
              style={{ borderColor: "var(--widget-border)", color: "var(--widget-text)" }}
            >
              Preview embed shell
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
