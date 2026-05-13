import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createCatalogSource } from "@/lib/tenant-platform";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId } = await params;
  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const connectionString = String(formData.get("connectionString") || "").trim();
  const queryText = String(formData.get("queryText") || "").trim();

  if (!name || !connectionString || !queryText) {
    return Response.json(
      { error: "name, connectionString, and queryText are required." },
      { status: 400 }
    );
  }

  try {
    await createCatalogSource({
      tenantId,
      type: "postgres",
      name,
      config: {
        connectionString,
        queryText,
      },
    });
    return Response.redirect(new URL("/admin", request.url), 303);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create source." },
      { status: 500 }
    );
  }
}
