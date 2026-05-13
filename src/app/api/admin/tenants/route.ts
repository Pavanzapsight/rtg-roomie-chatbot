import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  normalizeTenantCreateFormValues,
  parseTenantDomains,
  validateTenantCreateFormValues,
} from "@/lib/admin-tenant-validation";
import { createTenant } from "@/lib/tenant-platform";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const values = normalizeTenantCreateFormValues(
    Object.fromEntries(formData.entries())
  );
  const fieldErrors = validateTenantCreateFormValues(values);

  if (Object.keys(fieldErrors).length > 0) {
    return Response.json(
      {
        error: "Please correct the highlighted fields and try again.",
        fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    await createTenant({
      tenantKey: values.tenantKey,
      name: values.name,
      appName: values.appName || undefined,
      appUrl: values.appUrl || undefined,
      domains: parseTenantDomains(values.domains),
      prompt: {
        brandName: values.name,
        websiteUrl: values.appUrl || undefined,
        supportUrl: values.supportUrl || undefined,
        storeLocatorUrl: values.storeLocatorUrl || undefined,
        handoffDescription: values.handoffDescription || undefined,
      },
      branding: {
        assistantName: values.assistantName || undefined,
        launcherLabel: values.launcherLabel || undefined,
        headerTitle: values.headerTitle || undefined,
        inputPlaceholder: values.inputPlaceholder || undefined,
      },
    });
    return Response.redirect(new URL("/admin", request.url), 303);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create tenant." },
      { status: 500 }
    );
  }
}
