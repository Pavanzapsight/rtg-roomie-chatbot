import { isAdminAuthenticated } from "@/lib/admin-auth";
import { activateCatalogVersion } from "@/lib/tenant-platform";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { versionId } = await params;
  const formData = await request.formData();
  const tenantId = String(formData.get("tenantId") || "").trim();
  if (!tenantId) {
    return Response.json({ error: "tenantId is required." }, { status: 400 });
  }

  try {
    await activateCatalogVersion(tenantId, versionId);
    return Response.redirect(new URL("/admin", request.url), 303);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to activate catalog version." },
      { status: 500 }
    );
  }
}
