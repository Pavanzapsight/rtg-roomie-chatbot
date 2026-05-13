import { isAdminAuthenticated } from "@/lib/admin-auth";
import { buildCatalogDatasetFromPostgres } from "@/lib/catalog-ingestion";
import { buildCatalogDatasetFromShopify, getShopifyAppConfig } from "@/lib/shopify";
import {
  createCatalogVersion,
  getCatalogSource,
  getTenantShopifyInstallation,
  updateCatalogSourceSyncStamp,
} from "@/lib/tenant-platform";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await params;
  const formData = await request.formData();
  const sourceId = String(formData.get("sourceId") || "").trim();
  if (!sourceId) {
    return Response.json({ error: "sourceId is required." }, { status: 400 });
  }

  try {
    const source = await getCatalogSource(sourceId);
    if (!source || source.tenantId !== tenantId) {
      return Response.json({ error: "Catalog source not found." }, { status: 404 });
    }

    const dataset =
      source.type === "postgres"
        ? await buildCatalogDatasetFromPostgres({
            connectionString: String(source.config.connectionString || ""),
            queryText: String(source.config.queryText || ""),
          })
        : source.type === "shopify"
          ? await (async () => {
              const installation = await getTenantShopifyInstallation(tenantId);
              if (!installation || installation.status !== "installed") {
                throw new Error("Shopify installation not found for this tenant.");
              }
              return buildCatalogDatasetFromShopify({
                shop: installation.shopDomain,
                storefrontDomain: installation.storefrontDomain,
                accessToken: installation.accessToken,
                config: getShopifyAppConfig(new URL(request.url).origin),
              });
            })()
          : null;

    if (!dataset) {
      return Response.json({ error: `Sync is not supported for ${source.type} sources yet.` }, { status: 400 });
    }

    await createCatalogVersion({
      tenantId,
      sourceId: source.id,
      sourceType: source.type,
      label: `${source.name} sync ${new Date().toISOString().slice(0, 10)}`,
      dataset,
      activate: true,
    });
    await updateCatalogSourceSyncStamp(source.id);
    return Response.redirect(new URL("/admin", request.url), 303);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Postgres sync failed." },
      { status: 500 }
    );
  }
}
