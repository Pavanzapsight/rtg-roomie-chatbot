import type { PageContext } from "@/lib/system-prompt";

/** Parent → iframe postMessage type (see public/embed.js). */
export const RTG_PAGE_CONTEXT_MESSAGE = "rtg-page-context-update" as const;

const PAGE_TYPES = new Set<PageContext["page"]>([
  "pdp",
  "category",
  "cart",
  "homepage",
  "search",
  "unknown",
]);

function str(v: unknown, max = 4000): string | undefined {
  if (typeof v !== "string" || v.length === 0) return undefined;
  return v.length > max ? v.slice(0, max) : v;
}

function strArr(v: unknown, maxItems = 40, maxLen = 400): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .map((x) => (x.length > maxLen ? x.slice(0, maxLen) : x))
    .slice(0, maxItems);
  return out.length ? out : undefined;
}

/**
 * Validates data from the parent page (postMessage) before merging into
 * `window.RTG_CHAT_CONTEXT`. Rejects prototype pollution and oversized values.
 */
export function sanitizeHostPageContext(
  raw: unknown
): (PageContext & { dwellThreshold?: number }) | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const pageRaw = o.page;
  const page: PageContext["page"] =
    typeof pageRaw === "string" && PAGE_TYPES.has(pageRaw as PageContext["page"])
      ? (pageRaw as PageContext["page"])
      : "unknown";

  let dwellThreshold: number | undefined;
  if (typeof o.dwellThreshold === "number" && Number.isFinite(o.dwellThreshold)) {
    const t = Math.floor(o.dwellThreshold);
    if (t >= 0 && t <= 86_400_000) dwellThreshold = t;
  }

  const out: PageContext & { dwellThreshold?: number } = {
    page,
    productName: str(o.productName),
    productSku: str(o.productSku),
    category: str(o.category),
    cartItems: strArr(o.cartItems),
    searchQuery: str(o.searchQuery),
    pageHistory: strArr(o.pageHistory),
    purchasedProducts: strArr(o.purchasedProducts),
  };

  if (
    typeof o.dwellSeconds === "number" &&
    Number.isFinite(o.dwellSeconds) &&
    o.dwellSeconds >= 0 &&
    o.dwellSeconds < 86400
  ) {
    out.dwellSeconds = Math.floor(o.dwellSeconds);
  }

  if (dwellThreshold !== undefined) {
    out.dwellThreshold = dwellThreshold;
  }

  return out;
}

/** Only accept context updates from the embedding page’s window, not random frames. */
export function isAllowedContextMessageSource(
  source: MessageEvent["source"]
): boolean {
  if (source == null) return false;
  if (typeof window === "undefined") return false;
  if (window.parent !== window) {
    return source === window.parent;
  }
  return source === window;
}
