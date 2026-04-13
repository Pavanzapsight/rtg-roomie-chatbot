import { readFileSync } from "fs";
import { join } from "path";

export type ConversationStage =
  | "greeting"
  | "discovery"
  | "recommendation"
  | "comparison"
  | "closing";

let cachedTemplate: string | null = null;

function loadTemplate(): string {
  if (cachedTemplate) return cachedTemplate;
  const filePath = join(process.cwd(), "SYSTEM_PROMPT.md");
  cachedTemplate = readFileSync(filePath, "utf-8");
  return cachedTemplate;
}

// These are kept in code (not in the .md file) because triple-backtick HTML
// examples inside a markdown file get mangled when the model reads them.
const HTML_INSTRUCTIONS = `
## CRITICAL: Interactive HTML Output Rules

You MUST embed interactive HTML in your responses using fenced code blocks.
The syntax is: three backticks followed by "html", then your HTML, then three closing backticks.

Three JavaScript functions are pre-loaded and available:
- sendPrompt(text) — immediately sends text as a user chat message
- toggleSelect(element, value) — toggles a pill on/off for multi-select
- submitSelected(prefix) — sends all toggled values as one message

Pre-loaded CSS classes: .pill, .chip, .card, .card-title, .card-price, .card-tag, .tag-premium, .tag-value, .tag-cooling, .btn-primary, .btn-secondary, .btn-submit, .grid-2, .flex-wrap

### ABSOLUTE RULE: Product Cards

EVERY TIME you mention, recommend, or discuss a specific mattress product, you MUST render it as an HTML product card. NEVER describe a product in plain text. This is non-negotiable.

A product card looks exactly like this (replace bracketed values with real data):

THREE_BACKTICKS_html
<div class="card">
<div class="card-title">PRODUCT NAME HERE</div>
<span class="card-tag tag-value">TYPE</span><span class="card-tag tag-cooling">FEATURE</span>
<p style="margin:6px 0;font-size:13px">One line about why this fits their needs</p>
<div class="card-price">$X,XXX Size</div>
<div style="margin-top:8px;display:flex;gap:8px">
<button class="btn-primary" onclick="sendPrompt('Tell me more about PRODUCT NAME')">Details</button>
<button class="btn-secondary" onclick="sendPrompt('Compare PRODUCT NAME')">Compare</button>
</div>
</div>
THREE_BACKTICKS

If recommending 2-3 products, output each as its own separate card in its own HTML code block.

### ABSOLUTE RULE: Discovery Pills are ALWAYS Multi-Select

During discovery, NEVER use single-select pills (sendPrompt on each pill). ALWAYS use multi-select (toggleSelect) with a Submit button. This lets the customer pick multiple options before submitting.

Even for questions like size or budget — the customer might want to see options for BOTH "Queen" and "King", or BOTH "Under $800" and "$800-$1,500". Let them pick multiple, then submit.

The ONLY exception for single-select is sleep position (side/back/stomach/combo) since people have one primary position.

When asking multiple questions at once (e.g. size + budget), combine them into ONE multi-select block with labeled sections, not separate blocks:

THREE_BACKTICKS_html
<p style="font-size:13px;margin-bottom:4px;font-weight:600">What size?</p>
<div class="flex-wrap">
<button class="pill" onclick="toggleSelect(this,'Twin')">Twin</button>
<button class="pill" onclick="toggleSelect(this,'Twin XL')">Twin XL</button>
<button class="pill" onclick="toggleSelect(this,'Full')">Full</button>
<button class="pill" onclick="toggleSelect(this,'Queen')">Queen</button>
<button class="pill" onclick="toggleSelect(this,'King')">King</button>
<button class="pill" onclick="toggleSelect(this,'Cal King')">Cal King</button>
</div>
<p style="font-size:13px;margin:8px 0 4px;font-weight:600">Budget range?</p>
<div class="flex-wrap">
<button class="pill" onclick="toggleSelect(this,'Under $800')">Under $800</button>
<button class="pill" onclick="toggleSelect(this,'$800-$1,500')">$800-$1,500</button>
<button class="pill" onclick="toggleSelect(this,'$1,500-$3,000')">$1,500-$3,000</button>
<button class="pill" onclick="toggleSelect(this,'$3,000+')">$3,000+</button>
</div>
<button class="btn-submit" onclick="submitSelected('I want: ')">Submit</button>
THREE_BACKTICKS

### Single-select pills (ONLY for sleep position):

THREE_BACKTICKS_html
<div class="flex-wrap">
<button class="pill" onclick="sendPrompt('Side sleeper')">Side</button>
<button class="pill" onclick="sendPrompt('Back sleeper')">Back</button>
<button class="pill" onclick="sendPrompt('Stomach sleeper')">Stomach</button>
<button class="pill" onclick="sendPrompt('Combination sleeper')">Combo</button>
</div>
THREE_BACKTICKS

REMEMBER: The output format is three backticks + html, then the HTML, then three closing backticks. Products are ALWAYS cards. Discovery pills are ALWAYS multi-select with Submit (except sleep position). No exceptions.
`.replaceAll("THREE_BACKTICKS_html", "```html").replaceAll("THREE_BACKTICKS", "```");

export function buildSystemPrompt(
  catalogData: string,
  stage: ConversationStage
): string {
  const template = loadTemplate();

  const base = template
    .replace("{{CURRENT_STAGE}}", stage.toUpperCase())
    .replace("{{CATALOG_DATA}}", catalogData);

  // Append HTML instructions after the template (kept in code to avoid
  // triple-backtick conflicts in the markdown file)
  return base + "\n\n" + HTML_INSTRUCTIONS;
}
