import { ChatWidget } from "@/components/ChatWidget";
import { MockContextPanel } from "@/components/MockContextPanel";

export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ backgroundColor: "var(--widget-surface-alt)" }}
    >
      <div className="text-center">
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--widget-text)" }}
        >
          Storefront Demo
        </h1>
        <p
          className="mt-2 text-base"
          style={{ color: "var(--widget-text-muted)" }}
        >
          Demo page — the shopping assistant widget is in the bottom-right corner
        </p>
      </div>

      <MockContextPanel />

      <ChatWidget />
    </main>
  );
}
