"use client";

import { useState } from "react";

const PRESETS = {
  "First visit (no context)": {},
  "Browsing mattresses": {
    page: "category",
    category: "mattresses",
  },
  "On a product page": {
    page: "pdp",
    productName: "Beautyrest Harmony Lux",
    productSku: "BRT-HRM-LUX-Q",
    category: "mattresses",
  },
  "Returning — viewed 3 products": {
    page: "category",
    category: "mattresses",
    pageHistory: [
      "/mattresses/beautyrest-harmony",
      "/mattresses/sealy-posturepedic",
      "/mattresses/tempur-pedic-adapt",
    ],
  },
  "Has items in cart": {
    page: "cart",
    cartItems: ["Sealy Posturepedic Plus — Queen"],
    category: "mattresses",
  },
  "Previous purchaser": {
    page: "homepage",
    purchasedProducts: ["Beautyrest Harmony Lux — Queen"],
  },
  "Searching": {
    page: "search",
    searchQuery: "firm mattress for back pain",
    category: "mattresses",
  },
};

export function MockContextPanel() {
  const [selectedPreset, setSelectedPreset] = useState("");
  const [applied, setApplied] = useState("");

  const applyPreset = (name: string) => {
    const preset = PRESETS[name as keyof typeof PRESETS];
    if (!preset) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).RTG_CHAT_CONTEXT = { ...preset };
    setSelectedPreset(name);
    setApplied(name);

    // If preset has purchasedProducts, also update the visitor profile cookie
    if ("purchasedProducts" in preset && preset.purchasedProducts) {
      // Trigger a visit record with the purchase data
      window.postMessage(
        {
          type: "rtg-page-context-update",
          context: preset,
        },
        "*"
      );
    }
  };

  const clearContext = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).RTG_CHAT_CONTEXT;
    setSelectedPreset("");
    setApplied("");
    // Clear visitor profile cookie
    document.cookie = "rtg_visitor_profile=;path=/;max-age=0";
    document.cookie = "rtg_proactive_dismissed=;path=/;max-age=0";
  };

  return (
    <div
      className="mt-8 rounded-xl border p-4"
      style={{
        maxWidth: 480,
        borderColor: "var(--rtg-gray-200)",
        backgroundColor: "white",
      }}
    >
      <h3
        className="mb-2 text-sm font-semibold"
        style={{ color: "var(--rtg-charcoal)" }}
      >
        🧪 Test Panel — Simulate Page Context
      </h3>
      <p className="mb-3 text-xs" style={{ color: "var(--rtg-gray-700)" }}>
        Set <code>window.RTG_CHAT_CONTEXT</code> to simulate different pages on
        roomstogo.com. Refresh the chat widget after changing.
      </p>
      <div className="flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={{
              borderColor:
                selectedPreset === name
                  ? "var(--rtg-red)"
                  : "var(--rtg-gray-200)",
              backgroundColor:
                selectedPreset === name ? "var(--rtg-red)" : "white",
              color: selectedPreset === name ? "white" : "var(--rtg-charcoal)",
            }}
          >
            {name}
          </button>
        ))}
        <button
          onClick={clearContext}
          className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          style={{
            borderColor: "var(--rtg-gray-200)",
            color: "var(--rtg-gray-700)",
          }}
        >
          ✕ Clear all
        </button>
      </div>
      {applied && (
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--rtg-gray-700)" }}
        >
          ✓ Applied: <strong>{applied}</strong> — now open/refresh the chat
          widget
        </p>
      )}
    </div>
  );
}
