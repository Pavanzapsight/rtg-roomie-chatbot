import { ChatWidget } from "@/components/ChatWidget";

export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ backgroundColor: "#f5f5f5" }}
    >
      {/* Simulated page background — represents roomstogo.com */}
      <div className="text-center">
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--rtg-charcoal)" }}
        >
          RoomsToGo.com
        </h1>
        <p
          className="mt-2 text-base"
          style={{ color: "var(--rtg-gray-700)" }}
        >
          Demo page — the Roomie chat widget is in the bottom-right corner
        </p>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--rtg-gray-700)" }}
        >
          Upload a mattress catalog Excel file to enable product recommendations
        </p>
      </div>

      {/* Chat widget overlay */}
      <ChatWidget />
    </main>
  );
}
