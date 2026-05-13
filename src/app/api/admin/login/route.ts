import { ADMIN_SESSION_COOKIE, createAdminSessionValue, validateAdminCredentials } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  if (!validateAdminCredentials(username, password)) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/admin/login?error=invalid",
      },
    });
  }

  const response = new Response(null, {
    status: 303,
    headers: {
      Location: "/admin",
    },
  });
  response.headers.append(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${createAdminSessionValue()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
  );
  return response;
}
