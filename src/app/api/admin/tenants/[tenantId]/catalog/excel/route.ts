import { isAdminAuthenticated } from "@/lib/admin-auth";
import { buildCatalogDatasetFromExcel } from "@/lib/catalog-ingestion";
import { createCatalogSource, createCatalogVersion } from "@/lib/tenant-platform";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  const sourceName = String(formData.get("sourceName") || "").trim();
  const sheetName = String(formData.get("sheetName") || "").trim();

  if (!(file instanceof File)) {
    return Response.json({ error: "Excel file is required." }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const dataset = buildCatalogDatasetFromExcel(buffer, sheetName || undefined);
    const source = await createCatalogSource({
      tenantId,
      type: "excel",
      name: sourceName || file.name,
      config: {
        fileName: file.name,
        sheetName: sheetName || null,
      },
    });
    await createCatalogVersion({
      tenantId,
      sourceId: source.id,
      sourceType: "excel",
      label: `${source.name} (${new Date().toISOString().slice(0, 10)})`,
      dataset,
      activate: true,
    });
    return Response.redirect(new URL("/admin", request.url), 303);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Excel import failed." },
      { status: 500 }
    );
  }
}
