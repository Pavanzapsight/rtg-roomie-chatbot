import { readFileSync } from "fs";
import { join } from "path";

export type ConversationStage =
  | "returning"
  | "greeting"
  | "discovery"
  | "recommendation"
  | "comparison"
  | "closing"
  | "reengagement"
  | "contextual"
  | "new-session"
  | "interjection";

export interface VisitorProfile {
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  viewedProducts: string[];
  viewedCategories: string[];
  purchasedProducts: string[];
  lastConversationStage: string;
  preferences: Record<string, string>;
}

export interface BrowsingHistoryEntry {
  productName: string;
  productPrice?: string;
  productUrl?: string;
  viewedAt: string;
}

export interface PageContext {
  page: "pdp" | "category" | "cart" | "homepage" | "search" | "unknown";
  productName?: string;
  /** Shopify variant id (numeric) when the embed runs on a Shopify storefront — use with addToCart() in HTML. */
  productVariantId?: number;
  productSku?: string;
  productPrice?: string;
  productVendor?: string;
  productType?: string;
  productDescription?: string;
  productImage?: string;
  productUrl?: string;
  productTags?: string[];
  category?: string;
  cartItems?: string[];
  cartTotal?: string;
  cartCount?: number;
  searchQuery?: string;
  /** Seconds on current page (from embed / host). */
  dwellSeconds?: number;
  /** Proactive re-engagement threshold in ms (from mock panel / host). */
  dwellThreshold?: number;
  pageHistory?: string[];
  purchasedProducts?: string[];
  browsingHistory?: BrowsingHistoryEntry[];
}

const cache: Record<string, string> = {};

function loadFile(relativePath: string): string {
  if (cache[relativePath]) return cache[relativePath];
  const filePath = join(process.cwd(), relativePath);
  cache[relativePath] = readFileSync(filePath, "utf-8");
  return cache[relativePath];
}

/**
 * Build a human-readable context block so the AI knows exactly what the
 * customer is doing on the website right now.
 */
function buildContextNarrative(
  pageContext?: PageContext,
  visitorProfile?: VisitorProfile
): string {
  if (!pageContext && !visitorProfile) return "";

  const parts: string[] = [];

  if (pageContext) {
    parts.push("# CURRENT PAGE CONTEXT\n");

    if (pageContext.page === "pdp" && pageContext.productName) {
      parts.push(`The customer is currently viewing a product page:\n`);
      parts.push(`- **Product:** ${pageContext.productName}`);
      if (pageContext.productPrice) parts.push(`- **Price:** ${pageContext.productPrice}`);
      if (pageContext.productVendor) parts.push(`- **Brand:** ${pageContext.productVendor}`);
      if (pageContext.productType) parts.push(`- **Type:** ${pageContext.productType}`);
      if (pageContext.productSku) parts.push(`- **SKU:** ${pageContext.productSku}`);
      if (pageContext.productVariantId != null) {
        parts.push(`- **Shopify variant id:** ${pageContext.productVariantId} (use addToCart(${pageContext.productVariantId}) for the on-store cart)`);
      }
      if (pageContext.productDescription) parts.push(`- **Description:** ${pageContext.productDescription}`);
      if (pageContext.productTags && pageContext.productTags.length) {
        parts.push(`- **Tags:** ${pageContext.productTags.join(", ")}`);
      }
      if (pageContext.productUrl) parts.push(`- **URL:** ${pageContext.productUrl}`);
      parts.push("");
      parts.push("Use this product information when the customer asks about what they're looking at. You can proactively reference this product by name.");
    } else if (pageContext.page === "category") {
      parts.push(`The customer is browsing a category/collection page.`);
      if (pageContext.category) parts.push(`- **Category:** ${pageContext.category}`);
    } else if (pageContext.page === "cart") {
      parts.push(`The customer is on the cart page.`);
      if (pageContext.cartItems && pageContext.cartItems.length) {
        parts.push(`- **Cart items:** ${pageContext.cartItems.join("; ")}`);
        if (pageContext.cartTotal) parts.push(`- **Cart total:** ${pageContext.cartTotal}`);
      } else {
        parts.push(`- The cart appears to be empty.`);
      }
    } else if (pageContext.page === "search" && pageContext.searchQuery) {
      parts.push(`The customer is on search results for: "${pageContext.searchQuery}"`);
    } else if (pageContext.page === "homepage") {
      parts.push(`The customer is on the homepage.`);
    }

    // Browsing history
    if (pageContext.browsingHistory && pageContext.browsingHistory.length > 0) {
      parts.push("\n## BROWSING HISTORY\n");
      parts.push("Products the customer has viewed during this session (most recent first):\n");
      for (const entry of pageContext.browsingHistory.slice(0, 10)) {
        const ago = getTimeAgo(entry.viewedAt);
        parts.push(`- **${entry.productName}**${entry.productPrice ? " (" + entry.productPrice + ")" : ""}${ago ? " — viewed " + ago : ""}`);
      }
      parts.push("\nUse this history to understand what the customer is comparing and what price range they're exploring. Reference products they've viewed when making recommendations.");
    }

    if (pageContext.dwellSeconds) {
      parts.push(`\nThe customer has been on this page for about ${pageContext.dwellSeconds} seconds.`);
    }
  }

  if (visitorProfile) {
    parts.push("\n# VISITOR PROFILE\n");
    parts.push(`- **Visit count:** ${visitorProfile.visitCount}`);
    parts.push(`- **First visit:** ${visitorProfile.firstVisit}`);
    if (visitorProfile.viewedProducts.length > 0) {
      parts.push(`- **Previously viewed:** ${visitorProfile.viewedProducts.join(", ")}`);
    }
    if (visitorProfile.purchasedProducts.length > 0) {
      parts.push(`- **Past purchases:** ${visitorProfile.purchasedProducts.join(", ")}`);
    }
    if (Object.keys(visitorProfile.preferences).length > 0) {
      parts.push(`- **Known preferences:** ${JSON.stringify(visitorProfile.preferences)}`);
    }
  }

  return parts.length > 0 ? "\n\n---\n\n" + parts.join("\n") : "";
}

function getTimeAgo(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

// HTML output rules live in code to avoid triple-backtick conflicts in markdown
const HTML_INSTRUCTIONS = `
## CRITICAL: Interactive HTML Output Rules

You MUST embed interactive HTML in your responses using fenced code blocks.
The syntax is: three backticks followed by "html", then your HTML, then three closing backticks.

These JavaScript helpers are pre-loaded:
- sendPrompt(text) — immediately sends text as a user chat message
- openProduct(url, productName) — opens the Rooms To Go product page in the same browser tab. ALWAYS pass the product name as the second argument.
- addToCart(variantId, quantity) — **Shopify storefront embed only.** Adds a line item via the host store's \`/cart/add.js\`. \`variantId\` must be the numeric Shopify variant id (see page context). \`quantity\` defaults to 1.
- checkout() — **Shopify storefront embed only.** Sends the customer to the host store's checkout (\`/checkout\`).
- toggleSelect(element, value) — toggles a pill on/off for multi-select
- submitSelected(prefix) — sends all toggled values as one message

Pre-loaded CSS classes: .pill, .chip, .card, .card-title, .card-media, .card-image, .card-price, .card-tag, .tag-premium, .tag-value, .tag-cooling, .btn-primary, .btn-secondary, .btn-submit, .grid-2, .flex-wrap

Pre-loaded JavaScript: sendPrompt, toggleSelect, submitSelected, **openProduct(url, productName)** — use openProduct for real product page URLs from the catalog. ALWAYS pass the product name as the second argument for tracking.

### ABSOLUTE RULE: Product Cards

EVERY TIME you mention, recommend, or discuss a specific mattress product, you MUST render it as an HTML product card. NEVER describe a product in plain text. Non-negotiable.

**Catalog columns you MUST copy exactly for each product (same row):**
- **Image 1** — full https URL for the hero image (required in every card).
- **Product Link** — full https URL for the PDP (required for "View product" and image click).
- Sale Price, Regular Price, Theme, Mattress Type, Mattress Size, etc. — use as shown in CATALOG_DATA.

Product card format (replace placeholders with real values from that product's catalog row):

THREE_BACKTICKS_html
<div class="card">
<div class="card-media" onclick='openProduct("PASTE_PRODUCT_LINK_URL_HERE", "PRODUCT NAME")' title="View on Rooms To Go">
<img class="card-image" src="PASTE_IMAGE_1_URL_HERE" alt="PRODUCT NAME" loading="lazy" />
</div>
<div class="card-title">PRODUCT NAME</div>
<span class="card-tag tag-value">TYPE</span><span class="card-tag tag-cooling">FEATURE</span>
<p style="margin:6px 0;font-size:13px">One line about why this fits their needs</p>
<div class="card-price">$X,XXX Size</div>
<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
<button type="button" class="btn-primary" onclick='openProduct("PASTE_PRODUCT_LINK_URL_HERE", "PRODUCT NAME")'>View product</button>
<button type="button" class="btn-cart" onclick="addToCart(SHOPIFY_VARIANT_ID)">🛒 Add to Cart</button>
</div>
</div>
THREE_BACKTICKS

- **View product** and clicking the **image** must call **openProduct** with the exact **Product Link** URL from the catalog AND the product name as arguments. Do not invent URLs.
- If **Shopify variant id** appears in page context, use **addToCart(that numeric id)** on buttons for that on-store product; otherwise use **sendPrompt('Add PRODUCT NAME to cart')** for catalog-only flows.
- Use the exact **Image 1** URL in the img element's src attribute (optional second image: add another img using **Image 2** if present).
- For onclick handlers, use single quotes on the outside and double quotes around the URL inside openProduct(...) so URLs stay intact.

Each product = its own separate card in its own HTML code block.

### ABSOLUTE RULE: Post-Product Action Bar

After showing ALL product cards, you MUST show this action bar as a SEPARATE HTML code block. All 4 options always appear:

THREE_BACKTICKS_html
<div style="margin-top:4px">
<p style="font-size:13px;margin-bottom:6px;font-weight:500">What would you like to do?</p>
<div class="flex-wrap">
<button class="pill" onclick="sendPrompt('Tell me more about TOP_PICK_NAME')">👀 More on TOP_PICK</button>
<button class="pill" onclick="sendPrompt('Compare all these options')">⚖️ Compare all options</button>
<button class="pill" onclick="sendPrompt('Show me different options')">🔄 Other options</button>
<button class="pill" onclick="sendPrompt('I want to refine my preferences')">🎯 Refine more</button>
</div>
</div>
THREE_BACKTICKS

Replace TOP_PICK_NAME and TOP_PICK with the actual product name. This action bar appears after EVERY product recommendation.

### ABSOLUTE RULE: ALL Discovery Tiles are Multi-Select

During discovery, EVERY pill in EVERY HTML block MUST use toggleSelect(). NEVER use sendPrompt() on discovery pills — not even for sleep position. The customer selects everything they want across ALL sections, then hits one Submit button at the bottom.

This is because discovery blocks combine multiple questions (sleep position + size + budget). If ANY pill uses sendPrompt(), it fires immediately and the customer can't finish selecting the rest.

Example — a combined discovery block (ALL pills use toggleSelect, ONE Submit at the end):

THREE_BACKTICKS_html
<p style="font-size:13px;margin-bottom:4px;font-weight:600">🛏️ How do you sleep?</p>
<div class="flex-wrap">
<button class="pill" onclick="toggleSelect(this,'Side sleeper')">🛏️ Side</button>
<button class="pill" onclick="toggleSelect(this,'Back sleeper')">🔄 Back</button>
<button class="pill" onclick="toggleSelect(this,'Stomach sleeper')">😴 Stomach</button>
<button class="pill" onclick="toggleSelect(this,'Combination sleeper')">🔀 I move around</button>
</div>
<p style="font-size:13px;margin:8px 0 4px;font-weight:600">📐 What size?</p>
<div class="flex-wrap">
<button class="pill" onclick="toggleSelect(this,'Twin')">Twin</button>
<button class="pill" onclick="toggleSelect(this,'Twin XL')">Twin XL</button>
<button class="pill" onclick="toggleSelect(this,'Full')">Full</button>
<button class="pill" onclick="toggleSelect(this,'Queen')">Queen</button>
<button class="pill" onclick="toggleSelect(this,'King')">King</button>
<button class="pill" onclick="toggleSelect(this,'Cal King')">Cal King</button>
</div>
<p style="font-size:13px;margin:8px 0 4px;font-weight:600">💰 Budget?</p>
<div class="flex-wrap">
<button class="pill" onclick="toggleSelect(this,'Under $800')">Under $800</button>
<button class="pill" onclick="toggleSelect(this,'$800-$1,500')">$800-$1,500</button>
<button class="pill" onclick="toggleSelect(this,'$1,500-$3,000')">$1,500-$3,000</button>
<button class="pill" onclick="toggleSelect(this,'$3,000+')">$3,000+</button>
</div>
<button class="btn-submit" onclick="submitSelected('My preferences: ')">Show my matches →</button>
THREE_BACKTICKS

NEVER use sendPrompt() inside any discovery HTML block. ALL pills use toggleSelect(). ONE Submit button at the end. No exceptions.

### Post-Product Tiles

After showing products, always end with tile-based follow-up:

THREE_BACKTICKS_html
<div class="flex-wrap">
<button class="pill" onclick="sendPrompt('Tell me more about the top pick')">👀 More details</button>
<button class="pill" onclick="sendPrompt('Show me different options')">🔄 Different options</button>
<button class="pill" onclick="sendPrompt('Compare all these options')">⚖️ Compare all options</button>
</div>
THREE_BACKTICKS

Output format: three backticks + html → HTML → three closing backticks. Products = ALWAYS cards. Tiles = ALWAYS multi-select with Submit (except sleep position and post-product actions).
`.replaceAll("THREE_BACKTICKS_html", "```html").replaceAll("THREE_BACKTICKS", "```");

export function buildSystemPrompt(
  catalogData: string,
  stage: ConversationStage,
  options?: {
    pageContext?: PageContext;
    visitorProfile?: VisitorProfile;
    accessoryData?: string;
    interjectionType?: string;
  }
): string {
  // Load universal rules
  const base = loadFile("SYSTEM_PROMPT.md").replace(
    "{{CATALOG_DATA}}",
    catalogData
  );

  // Load stage-specific skill
  const skill = loadFile(`skills/${stage}.md`);

  // Build human-readable context (always included when available)
  const contextNarrative = buildContextNarrative(
    options?.pageContext,
    options?.visitorProfile
  );

  // Inject accessory catalog for closing stage
  const accessoryBlock = options?.accessoryData
    ? `\n\n---\n\n${options.accessoryData}`
    : "";

  // For interjection stage, tell the skill which sub-template to use
  const interjectionBlock = options?.interjectionType
    ? `\n\n---\n\n# INTERJECTION TYPE\n\nUse the "${options.interjectionType}" sub-template from the skill above.`
    : "";

  // Proactive stages (contextual/reengagement/interjection/new-session) must
  // NOT render product cards — the skill rules say so and the universal
  // "EVERY TIME you mention a product, use a card" rule would otherwise
  // deadlock the model. Emit a hard override so the skill wins.
  const PROACTIVE_STAGES = new Set<string>([
    "contextual",
    "reengagement",
    "interjection",
    "new-session",
  ]);
  const stageOverride = PROACTIVE_STAGES.has(stage)
    ? `\n\n---\n\n# HARD OVERRIDE FOR STAGE "${stage}"\n\nIn this stage only, IGNORE the "EVERY TIME you mention a product, render it as an HTML product card" rule. This message is a short proactive note — reference products by NAME (plain text or \`**bold**\`) and do not render product cards. You may still use tile/pill buttons (HTML) for quick-reply options. Follow the word count limit from the active skill.`
    : "";

  // Combine: universal rules + current stage skill + context + accessory data + override + HTML output rules
  return `${base}\n\n---\n\n# ACTIVE SKILL\n\n${skill}${contextNarrative}${accessoryBlock}${interjectionBlock}${stageOverride}\n\n---\n\n${HTML_INSTRUCTIONS}`;
}
