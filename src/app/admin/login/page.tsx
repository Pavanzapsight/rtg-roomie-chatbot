export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = (await (searchParams ?? Promise.resolve({}))) as { error?: string };

  return (
    <main className="min-h-screen px-6 py-16" style={{ background: "var(--widget-surface-alt)" }}>
      <div
        className="mx-auto max-w-md rounded-3xl border p-8 shadow-sm"
        style={{
          background: "var(--widget-surface)",
          borderColor: "var(--widget-border)",
          color: "var(--widget-text)",
        }}
      >
        <h1 className="text-2xl font-semibold">Admin Login</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--widget-text-muted)" }}>
          Internal operator access for tenant and catalog management.
        </p>
        {params.error === "invalid" ? (
          <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ background: "#fff1f1", color: "#9f1d1d" }}>
            Invalid credentials.
          </p>
        ) : null}
        <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Username</span>
            <input
              name="username"
              type="text"
              className="w-full rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--widget-border)" }}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Password</span>
            <input
              name="password"
              type="password"
              className="w-full rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--widget-border)" }}
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{
              background: "var(--widget-accent)",
              color: "var(--widget-accent-text)",
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
