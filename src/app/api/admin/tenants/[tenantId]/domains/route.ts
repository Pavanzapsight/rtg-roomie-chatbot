import { isAdminAuthenticated } from "@/lib/admin-auth";
import { addTenantDomain } from "@/lib/tenant-platform";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await params;
  const formData = await request.formData();
  const hostname = String(formData.get("hostname") || "").trim().toLowerCase();
  if (!hostname) {
    return Response.json({ error: "hostname is required." }, { status: 400 });
  }

  try {
    await addTenantDomain(tenantId, hostname);
    return Response.redirect(new URL("/admin", request.url), 303);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to add domain." },
      { status: 500 }
    );
  }
}
