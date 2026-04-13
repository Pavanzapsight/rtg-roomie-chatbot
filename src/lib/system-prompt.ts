import { readFileSync } from "fs";
import { join } from "path";

export type ConversationStage =
  | "proactive"
  | "returning"
  | "greeting"
  | "discovery"
  | "recommendation"
  | "comparison"
  | "closing";

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

export interface PageContext {
  page: "pdp" | "category" | "cart" | "homepage" | "search" | "unknown";
  productName?: string;
  productSku?: string;
  category?: string;
  cartItems?: string[];
  searchQuery?: string;
  dwellSeconds?: number;
  pageHistory?: string[];
}

const cache: Record<string, string> = {};

function loadFile(relativePath: string): string {
  if (cache[relativePath]) return cache[relativePath];
  const filePath = join(process.cwd(), relativePath);
  cache[relativePath] = readFileSync(filePath, "utf-8");
  return cache[relativePath];
}

// HTML output rules live in code to avoid triple-backtick conflicts in markdown
const HTML_INSTRUCTIONS = `
## CRITICAL: Interactive HTML Output Rules

You MUST embed interactive HTML in your responses using fenced code blocks.
The syntax is: three backticks followed by "html", then your HTML, then three closing backticks.

These JavaScript helpers are pre-loaded:
- sendPrompt(text) — immediately sends text as a user chat message
- openProduct(url) — opens the Rooms To Go product page (Product Link from catalog) in a new browser tab
- toggleSelect(element, value) — toggles a pill on/off for multi-select
- submitSelected(prefix) — sends all toggled values as one message

Pre-loaded CSS classes: .pill, .chip, .card, .card-title, .card-media, .card-image, .card-price, .card-tag, .tag-premium, .tag-value, .tag-cooling, .btn-primary, .btn-secondary, .btn-submit, .grid-2, .flex-wrap

Pre-loaded JavaScript: sendPrompt, toggleSelect, submitSelected, **openProduct(url)** — use openProduct for real product page URLs from the catalog.

### ABSOLUTE RULE: Product Cards

EVERY TIME you mention, recommend, or discuss a specific mattress product, you MUST render it as an HTML product card. NEVER describe a product in plain text. Non-negotiable.

**Catalog columns you MUST copy exactly for each product (same row):**
- **Image 1** — full https URL for the hero image (required in every card).
- **Product Link** — full https URL for the PDP (required for “View product” and image click).
- Sale Price, Regular Price, Theme, Mattress Type, Mattress Size, etc. — use as shown in CATALOG_DATA.

Product card format (replace placeholders with real values from that product’s catalog row):

THREE_BACKTICKS_html
<div class="card">
<div class="card-media" onclick='openProduct("PASTE_PRODUCT_LINK_URL_HERE")' title="View on Rooms To Go">
<img class="card-image" src="PASTE_IMAGE_1_URL_HERE" alt="PRODUCT NAME" loading="lazy" />
</div>
<div class="card-title">PRODUCT NAME</div>
<span class="card-tag tag-value">TYPE</span><span class="card-tag tag-cooling">FEATURE</span>
<p style="margin:6px 0;font-size:13px">One line about why this fits their needs</p>
<div class="card-price">$X,XXX Size</div>
<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
<button type="button" class="btn-primary" onclick='openProduct("PASTE_PRODUCT_LINK_URL_HERE")'>View product</button>
<button type="button" class="btn-secondary" onclick="sendPrompt('Compare PRODUCT NAME')">Compare</button>
<button type="button" style="background:#2E7D32;color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer" onclick="sendPrompt('Add PRODUCT NAME to cart')">🛒 Add to Cart</button>
</div>
</div>
THREE_BACKTICKS

- **View product** and clicking the **image** must call **openProduct** with the exact **Product Link** URL from the catalog (opens the real PDP in a new tab). Do not invent URLs.
- Use the exact **Image 1** URL in the img element’s src attribute (optional second image: add another img using **Image 2** if present).
- For onclick handlers, use single quotes on the outside and double quotes around the URL inside openProduct(...) so URLs stay intact.

Each product = its own separate card in its own HTML code block.

### ABSOLUTE RULE: Post-Product Action Bar

After showing ALL product cards, you MUST show this action bar as a SEPARATE HTML code block. All 4 options always appear:

THREE_BACKTICKS_html
<div style="margin-top:4px">
<p style="font-size:13px;margin-bottom:6px;font-weight:500">What would you like to do?</p>
<div class="flex-wrap">
<button class="pill" onclick="sendPrompt('Tell me more about TOP_PICK_NAME')">👀 More on TOP_PICK</button>
<button class="pill" onclick="sendPrompt('Compare these mattresses')">⚖️ Compare them</button>
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
<button class="pill" onclick="sendPrompt('Compare these for me')">⚖️ Compare</button>
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
  }
): string {
  // Load universal rules
  const base = loadFile("SYSTEM_PROMPT.md").replace(
    "{{CATALOG_DATA}}",
    catalogData
  );

  // Load stage-specific skill
  const skill = loadFile(`skills/${stage}.md`);

  // Build context blocks
  let contextBlocks = "";

  if (options?.pageContext && stage === "proactive") {
    contextBlocks += `\n\n# PAGE CONTEXT\n\n\`\`\`json\n${JSON.stringify(options.pageContext, null, 2)}\n\`\`\``;
  }

  if (options?.visitorProfile && (stage === "returning" || stage === "greeting")) {
    contextBlocks += `\n\n# VISITOR PROFILE\n\n\`\`\`json\n${JSON.stringify(options.visitorProfile, null, 2)}\n\`\`\``;
  }

  // Combine: universal rules + current stage skill + context + HTML output rules
  return `${base}\n\n---\n\n# ACTIVE SKILL\n\n${skill}${contextBlocks}\n\n---\n\n${HTML_INSTRUCTIONS}`;
}
