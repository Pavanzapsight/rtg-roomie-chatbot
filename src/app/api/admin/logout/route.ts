export async function POST() {
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: "/admin/login",
    },
  });
  response.headers.append(
    "Set-Cookie",
    "rtg_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );
  return response;
}
