# RTG Roomie Chatbot — Architecture & Reuse Guide

**Purpose:** Comprehensive reference for the chatbot's architecture, design decisions, and lessons learned. Written to enable building a similar chatbot for any industry using this codebase as the base.

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [System Architecture](#2-system-architecture)
3. [Conversation Stages & Skill Routing](#3-conversation-stages--skill-routing)
4. [Prompt Engineering Patterns](#4-prompt-engineering-patterns)
5. [Product Readiness Gate](#5-product-readiness-gate)
6. [Interactive Tiles & Cards](#6-interactive-tiles--cards)
7. [Proactive Messaging System](#7-proactive-messaging-system)
8. [Visitor Profile & Persistence](#8-visitor-profile--persistence)
9. [Complaint Detection & Hard Override](#9-complaint-detection--hard-override)
10. [Stage Transition & Inference](#10-stage-transition--inference)
11. [Build Pipeline & Data Prebaking](#11-build-pipeline--data-prebaking)
12. [Rendering & Streamdown](#12-rendering--streamdown)
13. [Iframe Isolation & Messaging](#13-iframe-isolation--messaging)
14. [Timing Constants](#14-timing-constants)
15. [Design Decisions & Rationale](#15-design-decisions--rationale)
16. [Prompt Engineering Lessons](#16-prompt-engineering-lessons)
17. [State Management Lessons](#17-state-management-lessons)
18. [Embed & Persistence Lessons](#18-embed--persistence-lessons)
19. [Reuse Checklist (Cross-Industry)](#19-reuse-checklist-cross-industry)
20. [Known Constraints & Future Improvements](#20-known-constraints--future-improvements)
21. [File Reference](#21-file-reference)

---

## 1. What This Is

**Roomie** is an AI-powered mattress shopping assistant for Rooms To Go (RTG), deployed as a floating chat widget on Shopify storefronts. It guides customers through: discovery → recommendation → comparison → add-to-cart → accessory cross-sell → checkout.

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| AI SDK | Vercel AI SDK v6 (`@ai-sdk/react`, `useChat`, `DefaultChatTransport`) |
| LLM Gateway | OpenRouter (`@openrouter/ai-sdk-provider`) |
| Default Model | Gemini Flash 3 (`google/gemini-3-flash-preview`) |
| Deployment | Vercel (serverless functions) |
| Embed | Single `<script>` tag on Shopify → cross-origin iframe |
| Data | Excel catalog → build-time prebake → TypeScript string constants |
| Markdown | Streamdown (streaming markdown renderer) |
| Persistence | Host-page localStorage via postMessage bridge |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ HOST PAGE (Shopify)                                             │
│ - embed.js (single-script embed)                                │
│ - Detects page context: PDP / category / cart / homepage        │
│ - Tracks browsing history & cart via localStorage               │
│ - State 3 interjection scheduler (timers while chat closed)     │
└────────────┬────────────────────────────────────────────────────┘
             │ postMessage (cross-origin)
┌────────────▼────────────────────────────────────────────────────┐
│ IFRAME: /embed                                                  │
│ - ChatWidget (React, client-side state machine)                 │
│ - Streamdown rendering + InlineHTML iframes for tiles/cards     │
│ - Proactive guard (debounce, cooldown, cart-blocking)           │
│ - Stage inference (persistent vs transient)                     │
└────────────┬────────────────────────────────────────────────────┘
             │ HTTP POST /api/chat
┌────────────▼────────────────────────────────────────────────────┐
│ NEXT.JS BACKEND: /api/chat                                      │
│ - Assembles: universal prompt + stage skill + context + catalog │
│ - OpenRouter multi-model dispatch                               │
│ - Vercel IP geolocation headers → customer location block       │
│ - Complaint detection (server-side, overrides stage)            │
└────────────┬────────────────────────────────────────────────────┘
┌────────────▼────────────────────────────────────────────────────┐
│ DATA LAYER (prebaked at build time)                              │
│ - catalog-raw.ts: full product markdown + JSON rows             │
│ - system-prompt-raw.ts: universal rules                         │
│ - skills-raw.ts: 12 skill files as key-value map                │
│ - Zero runtime filesystem reads                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Conversation Stages & Skill Routing

12 stages, split into **persistent** (define flow) and **transient** (one-shot, don't persist):

### Persistent Stages

| Stage | Skill File | Purpose |
|---|---|---|
| `greeting` | `greeting.md` | Warm intro + context question |
| `discovery` | `discovery.md` | Gather preferences (2-question max) |
| `recommendation` | `recommendation.md` | Show 2-3 product cards + action bar |
| `comparison` | `comparison.md` | Side-by-side table + committed pick |
| `closing` | `closing.md` | Confirm choice + cross-sell journey |
| `complaint` | `complaint.md` | Empathy + route to support channels |
| `returning` | `returning.md` | Cart-aware welcome back |

### Transient Stages (fire once, revert to last persistent)

| Stage | Skill File | Trigger |
|---|---|---|
| `new-session` | `new-session.md` | Fresh session (all tabs were closed) |
| `interjection` | `interjection.md` | Chat closed, timer elapsed (5 sub-templates) |
| `contextual` | `contextual.md` | Chat open, on PDP, dwelled 5s |
| `reengagement` | `reengagement.md` | Chat open, 20 min idle |
| `upsell` | `upsell.md` | Post-Add-to-Cart cross-sell |

**Key pattern:** After a transient message, `inferStage()` walks backwards through history and skips transient stage tags to find the last persistent stage. This prevents proactive messages from corrupting the conversation flow.

---

## 4. Prompt Engineering Patterns

### Dynamic Prompt Assembly

```
SYSTEM_PROMPT = [Universal Base] + [Stage Skill] + [Context Narrative] + [Catalog] + [Location Block] + [Output Rules]
```

**Universal Base** (`SYSTEM_PROMPT.md`, ~384 lines): Identity, complaint override, personality, verbosity, question format, readiness gate, price/promotion handling, firmness mapping, store/location handling, hard rules, voice/terminology, stage tags.

**Stage Skill** (one of 12 `.md` files): Stage-specific instructions, tile templates, exit criteria.

**Context Narrative** (built dynamically): Current page, cart status, browsing history, visitor profile — injected so the AI is context-aware without hardcoding.

**Catalog** (prebaked markdown table): All products with prices, images, variant IDs, discount status.

**Output Rules** (two variants):
- Full HTML instructions (product cards + tiles) for recommendation/discovery/comparison/closing
- Lean HTML instructions (tiles only, no product cards) for proactive/complaint stages

---

## 5. Product Readiness Gate

Do NOT show products until you have at least **4 of 7 signals** (first 2 mandatory):

1. **Why they're shopping** (mandatory) — replacing, new home, pain, upgrade
2. **Sleep experience** (mandatory) — what they like/dislike, pain point, temperature
3. Who's sleeping (solo, couple, child)
4. Sleep position (side, back, stomach, combo)
5. Body weight/build
6. Size (Twin, Full, Queen, King, Cal King)
7. Temperature tendency

**Exception:** Price/promotion queries bypass the gate entirely (information request ≠ recommendation).

---

## 6. Interactive Tiles & Cards

HTML blocks are fenced in markdown (` ```html ... ``` `), intercepted by `InlineHTML.tsx`, and rendered in **sandboxed iframes** (`sandbox="allow-scripts"`).

### Bridge Functions (available inside every tile iframe)

| Function | What it does |
|---|---|
| `sendPrompt(text)` | Sends text as a user message |
| `toggleSelect(el, value)` | Multi-select toggle |
| `submitSelected(prefix)` | Submit all selected values |
| `addToCart(variantId, qty)` | POST to Shopify `/cart/add.js` |
| `openProduct(url, name)` | Open product page in parent window |
| `checkout()` | Navigate parent to `/checkout` |

### Tile Types

- **Single-click prompt tiles** — `sendPrompt('Tell me more')` — fires immediately
- **Multi-select with Submit** — `toggleSelect` + `submitSelected` — discovery questions
- **Add-to-Cart** — `addToCart(12345678)` — Shopify variant ID from catalog
- **Product cards** — image + name + price + View product + Add to Cart
- **Action bar** (mandatory after every product display) — More on X / Compare / Other options / Refine more

---

## 7. Proactive Messaging System

### 4 Trigger States

| State | When | Timing | Tiles |
|---|---|---|---|
| State 1: Reengagement | Chat OPEN, 20 min idle | Once per idle cycle | 4 (Yes/Browsing/Store/Agent) |
| State 2: Contextual | Chat OPEN, on PDP, 5s dwell | 30s cooldown | 3 |
| State 3: Interjection | Chat CLOSED | 20s / 40s / 60s / every 2 min | 3 or 4 (resume gets 4) |
| State 4: New-session | Fresh session | 2s after page load | 2-3 |

### Proactive Guard (Global Gate)

All proactive messages pass through `useProactiveGuard.canFire()`:

1. ❌ if `humanMode` (live agent active)
2. ❌ if `isStreaming` (AI responding)
3. ❌ if on cart or checkout page
4. ❌ if < 15s since last proactive (stack debounce) — **upsell and contextual bypass this**
5. ❌ if < 20s since user's last message (conversation cooldown) — **new-session and upsell bypass this**

### Interjection Sub-templates

| Sub-template | Condition | Tiles |
|---|---|---|
| `compare` | 2+ products viewed | 3 (Compare / Help decide / Just looking) |
| `inform` | Currently on a PDP | 3 (Tell me more / Sizes & price / I'm good) |
| `guide` | No products viewed | 3 (Let's do it / Bestsellers / Just browsing) |
| `social` | Exactly 1 product viewed | 3 (Show accessories / Compare picks / Just browsing) |
| `resume` | 2+ prior user messages | 4 (Yes continue / Just browsing / Visit store / Talk to agent) |

---

## 8. Visitor Profile & Persistence

### Storage Architecture

**Host-page localStorage** (via embed.js postMessage bridge):

| Key | Purpose |
|---|---|
| `rtg_session_id` | Unique session across tabs |
| `rtg_chat_messages` | Serialized chat history (max 100) |
| `rtg_browsing_history` | Products viewed (max 30) |
| `rtg_visitor_profile` | Visit count, viewed products, preferences |
| `rtg_widget_open` | Widget open/closed state |
| `rtg_suppress_returning` | Block "Welcome back" after refresh |
| `rtg_last_greeting_at` | 60s multi-tab greeting cooldown |
| `rtg_pending_product` | Product to load after navigation |

**Per-tab sessionStorage** (via embed.js):

| Key | Purpose |
|---|---|
| `rtg_session_marker` | Detects new session (all tabs closed) |
| `rtg_session_started_at` | Clock baseline for State 3 thresholds |
| `rtg_state3_count` | Interjection count this session |
| `rtg_last_interjection_at` | Timestamp for relative pacing |

### Why localStorage (not cookies)

Safari ITP blocks 3rd-party cookies but allows 1st-party localStorage. Since embed.js runs on the Shopify domain (1st-party), localStorage persists. The iframe (3rd-party) accesses it via postMessage bridge.

---

## 9. Complaint Detection & Hard Override

### Dual-Layer Detection

**Layer 1 — Client-side regex** (`complaint-detection.ts`, 58 patterns):
- Return/refund/exchange intent
- Defect/malfunction words (broken, sagging, damaged)
- Warranty/complaint intent
- Strong frustration (terrible, furious, lawsuit, BBB)
- Ownership + problem patterns ("my mattress is sagging")
- Delivery/service/billing issues

**Layer 2 — Server-side stage override** (`route.ts`):
```
if (isComplaintMessage(lastUserText)) → force stage = "complaint"
```

This runs BEFORE the AI sees the message. Prevents "Have you considered the Harmony Lux?" on top of a return request.

### Complaint Skill Behavior

- ONE sincere apology sentence
- Route to: `roomstogo.com/help`, customer care phone, or in-store
- Always include "Talk to a human" tile
- NO discovery questions, NO upsell, NO product cards
- 5 sub-types: return/refund, product defect, comfort/fit, service/delivery, billing

---

## 10. Stage Transition & Inference

```typescript
function inferStage(messages): ConversationStage {
  // Walk backwards through assistant messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const stage = detectStageFromResponse(messages[i].text);
    // Skip transient stages (interjection, contextual, etc.)
    if (stage && !TRANSIENT_STAGES.has(stage)) return stage;
  }
  // Fallback: no user messages → "greeting"; else "discovery"
  return userMessages.length === 0 ? "greeting" : "discovery";
}
```

Stage tags (`[STAGE:discovery]`) are:
- Generated by the AI at the end of every response
- Stripped before display (user never sees them)
- Parsed by regex: `/\[STAGE:\s*(stage_name)\s*\]\s*$/i`

---

## 11. Build Pipeline & Data Prebaking

### Why Prebake

Vercel serverless functions can't access arbitrary files at runtime. `readFileSync(process.cwd() + '/file.xlsx')` fails because the bundler doesn't include files referenced only via dynamic paths.

### How It Works

```
npm run build
  → node scripts/prebuild.js     (reads Excel + .md files)
  → generates src/data/*.ts       (importable string constants)
  → next build                    (bundler includes them via import)
```

### Generated Files

| File | Contents |
|---|---|
| `src/data/catalog-raw.ts` | `CATALOG_RAW` (markdown table) + `CATALOG_ROWS` (JSON array) |
| `src/data/system-prompt-raw.ts` | `SYSTEM_PROMPT_RAW` (full prompt text) |
| `src/data/skills-raw.ts` | `SKILLS` (key-value map of all 12 skills) |

These are in `.gitignore` — regenerated on every build. If you edit SYSTEM_PROMPT.md, a skill file, or the Excel, you must rebuild for changes to take effect.

### Case-Sensitivity

The Excel file may be `updated rtg.xlsx` (macOS) or `Updated RTG.xlsx` (git). The prebuild script uses a case-insensitive regex: `/^updated\s*rtg\.xlsx$/i` to find it on both macOS (case-insensitive) and Linux/Vercel (case-sensitive).

---

## 12. Rendering & Streamdown

Messages are rendered via **Streamdown** (streaming markdown-to-React):

```tsx
<Streamdown
  mode={isStreaming ? "streaming" : "static"}
  linkSafety={{ enabled: false }}
  components={{
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ),
  }}
>
  {messageText}
</Streamdown>
```

- `linkSafety: false` — disabled the inline "Open external link?" modal (was breaking UX)
- All links forced to `target="_blank"` — prevents navigating the chat iframe away
- HTML blocks (` ```html ``` `) extracted and rendered via `InlineHTML` in sandboxed iframes

---

## 13. Iframe Isolation & Messaging

### PostMessage Protocol (13 message types)

**Chat → Host:**

| Type | Purpose |
|---|---|
| `rtg-embed-ready` | Iframe loaded, ready for init |
| `rtg-widget-open` | Widget expanded → resize iframe |
| `rtg-widget-close` | Widget minimized → shrink iframe |
| `rtg-save-messages` | Persist chat to host localStorage |
| `rtg-save-profile` | Persist visitor profile |
| `rtg-clear-messages` | Wipe chat history |
| `rtg-set-suppress-returning` | Set refresh-suppress flag |
| `rtg-clear-suppress-returning` | Clear refresh-suppress flag |
| `rtg-navigate` | Navigate host to URL |
| `rtg-add-to-cart` | Add item to Shopify cart |
| `rtg-checkout` | Navigate to /checkout |
| `rtg-open-url` | Open product page in host |
| `rtg-send-prompt` | Tile click → user message |

**Host → Chat:**

| Type | Purpose |
|---|---|
| `rtg-init` | Full initialization payload (messages, profile, context, history, flags) |
| `rtg-page-context-update` | SPA navigation or async data (cart refresh, PDP details) |
| `rtg-activity` | User activity pulse (throttled to 1 per 5s) |
| `rtg-interjection` | State 3 timer elapsed → fire interjection |
| `rtg-cart-action-result` | Add-to-cart success/failure response |

### Iframe Sizing

- **Closed:** 300×90px (just the pill button)
- **Open:** min(440px, 100vw) × min(720px, 100vh)
- **Transition:** 0.3s ease on width + height
- **Z-index:** 2147483647 (max)
- **Position:** fixed, bottom-right

### Auto-Resize (InlineHTML iframes)

Inner iframes (for tiles/cards) auto-resize via:
- MutationObserver on body (DOM changes)
- ResizeObserver on body (size changes from any cause)
- Image load handlers
- Font load handler
- Staggered retries (10ms, 100ms, 300ms, 800ms, 1500ms)
- +2px buffer to prevent sub-pixel clipping

---

## 14. Timing Constants

| Constant | Value | Location | Purpose |
|---|---|---|---|
| `IDLE_THRESHOLD_MS` | 20 min | ChatWidget.tsx | Re-engagement trigger |
| `CONTEXTUAL_DWELL_MS` | 5 sec | ChatWidget.tsx | PDP dwell before contextual |
| `CONTEXTUAL_COOLDOWN_MS` | 30 sec | ChatWidget.tsx | Between contextual messages |
| `PROACTIVE_DEBOUNCE_MS` | 15 sec | useProactiveGuard.ts | Between any proactive messages |
| `USER_MSG_COOLDOWN_MS` | 20 sec | useProactiveGuard.ts | After user sends message |
| `STATE3_THRESHOLDS` | [20s, 40s, 60s] | embed.js | First 3 interjection times |
| `STATE3_RECURRING_GAP_MS` | 2 min | embed.js | Gap after 3rd interjection |
| `STATE3_CHECK_INTERVAL` | 5 sec | embed.js | Polling interval |
| `STATE3_NAV_GUARD_MS` | 8 sec | embed.js | Don't fire within 8s of navigation |
| `GREETING_COOLDOWN_MS` | 60 sec | embed.js | Multi-tab greeting lock |
| `MAX_SESSION_AGE_MS` | 6 hours | embed.js | Session expiry |
| `MAX_HISTORY` | 30 | embed.js | Browsing history cap |
| New-session trigger | 2 sec | ChatWidget.tsx | Auto-open delay |
| Activity throttle | 5 sec | embed.js | Host → iframe pulse interval |

---

## 15. Design Decisions & Rationale

### Why Skill-Based Routing (not a single monolithic prompt)
Each stage needs different behavior. Discovery needs tight gates; closing needs cross-sell discipline; complaint needs empathy. A single 50KB+ prompt would be unmaintainable. Skills isolate concerns.

### Why Transient vs Persistent Stages
Proactive messages (interjection, contextual) should NOT change what skill loads next. After a "nudge" fires, the conversation resumes from the last real stage, not "contextual."

### Why Complaint Override at Two Levels
Client-side regex catches complaints BEFORE the AI responds (latency matters). Server-side stage tag is the authoritative routing. Both are needed — regex for speed, stage tag for correctness.

### Why Prebaked Catalog (not runtime DB)
Vercel serverless has no persistent storage. All data must ship in the JS bundle. Prebaking allows 500+ rows as a string constant with zero runtime I/O. Trade-off: catalog updates require rebuild.

### Why postMessage Bridge (not direct storage)
Embed.js runs on the Shopify domain (1st-party storage). The iframe is cross-origin. postMessage is the only safe way to bridge data between them. Fire-and-forget, async-compatible.

### Why Sandboxed Iframes for Tiles
HTML generated by the AI is rendered client-side. `sandbox="allow-scripts"` prevents malicious HTML from accessing cookies or parent DOM. Only `sendPrompt`, `addToCart`, `checkout`, and `openProduct` are exposed.

### Why Multi-Select by Default
Customers answer discovery questions with multiple signals ("I sleep hot AND my partner tosses AND I need a King"). Multi-select in one turn is faster than serial single-selects. Exception: sleep position (one primary position).

### Why Static Welcome + AI Greeting
The static welcome shows instantly (no LLM latency). The AI greeting streams in at 2s with personalized content. The static welcome is injected into the AI's context as a synthetic assistant message so the AI doesn't re-introduce itself.

---

## 16. Prompt Engineering Lessons

1. **Gate before recommending.** Require N signals before showing products. Prevents recommending a soft mattress to a 250 lb stomach sleeper.
2. **Firmness mapping is non-negotiable.** Weight × position determines effective feel. This belongs in the universal prompt, not a skill.
3. **Price is a filter, not a driver.** Never quote price without size. Never use price to stall discovery.
4. **Verbosity is the enemy.** Max 3-4 sentences. Bold the one takeaway. Let product cards do the talking.
5. **One message = one job.** Either ask a question, OR show products, OR make a recommendation. Never all three.
6. **Tiles > open-ended text (almost always).** Interactive tiles are faster than typing. Default to tiles; only use open-ended for the opening question.
7. **Complaint override is critical.** If they say "return this," the next message MUST NOT recommend a product. Hard gate, not suggestion.
8. **Cross-sell in fixed order.** Lifestyle Base → Protector → Pillow → Sheets. Predictable UX beats "smart" randomization.
9. **Cart awareness is non-negotiable.** Every response checks cart status. Never recommend something already there.
10. **Price-sensitive flag persists.** Once they ask about deals, bias toward discounts for the rest of the session. Don't change their top pick — prefer it when fits are equivalent.
11. **No medical claims.** "Help with" / "support" / "designed for" — never "solve" / "cure" / "fix." Legal liability.
12. **Prompt growth degrades quality.** The system prompt nearly tripled (170 → 400 lines). Flash models struggle with dense, long prompts. Consolidate or move conditional rules into skills.

---

## 17. State Management Lessons

1. **Use refs for volatile state.** `lastContextualProductRef`, `lastActivityAtRef` need persistence across renders but shouldn't trigger renders. Use `useRef`, not `useState`.
2. **Debounce proactive messages aggressively.** 15s minimum between any two proactive messages. Without it, the system stacks contextual + interjection + re-engagement simultaneously.
3. **User activity cooldown is generous.** 20s after a user message, don't fire proactive messages. They're reading/thinking.
4. **Cart & checkout are no-proactive zones.** Never interrupt a committed shopper.
5. **Event-driven triggers bypass debounce.** Upsell (post-Add-to-Cart) and contextual (PDP dwell) are user-initiated — they should fire even if a proactive message fired 5s ago.

---

## 18. Embed & Persistence Lessons

1. **First-party storage survives Safari ITP.** Use host-page localStorage, not 3rd-party cookies.
2. **postMessage is the glue.** Between embed.js (host) and ChatWidget (iframe), it's the only safe bridge.
3. **Detect platform context early.** embed.js reads ShopifyAnalytics metadata + DOM at load time. This context (PDP, cart, search) drives proactive behavior.
4. **Browsing history is a cheap win.** Track product URLs + prices + timestamps. Enables comparison interjections and price-sensitivity detection.
5. **Session ID prevents collisions.** Unique per tab, stored in localStorage. Prevents duplicate triggers across multiple windows.
6. **Case sensitivity matters on Linux.** macOS is case-insensitive; Vercel's build runner is Linux (case-sensitive). File lookups must be case-insensitive or normalized.

---

## 19. Reuse Checklist (Cross-Industry)

### Phase 1: Prompt Engineering (2-3 weeks)
- [ ] Rewrite `SYSTEM_PROMPT.md` for your domain
  - [ ] Identity & brand voice
  - [ ] Complaint signals (domain-specific)
  - [ ] Readiness gate (what signals before recommending?)
  - [ ] Attribute mapping (your domain's equivalent of weight × position → firmness)
  - [ ] Hard rules, voice/terminology
- [ ] Rewrite skills (core 5 + proactive 6 + complaint)
- [ ] Build test conversations before implementing

### Phase 2: Data & Catalog (1-2 weeks)
- [ ] Build Excel catalog matching the schema (Product, Brand, Description, Price, Category, Images, Variant IDs)
- [ ] Define your accessory categories and cross-sell order
- [ ] Update `scripts/prebuild.js` for your columns
- [ ] Add Discount / Discount % if applicable

### Phase 3: Integration (2-3 weeks)
- [ ] Update complaint-detection.ts patterns for your domain
- [ ] Update catalog.ts if your categories differ
- [ ] Adapt embed.js context detection for your platform (Shopify/Magento/WooCommerce/custom)
- [ ] Update tile patterns and card CSS
- [ ] Test all 4 proactive flows

### Phase 4: Deploy & Iterate
- [ ] Deploy embed.js to CDN
- [ ] Test on staging storefront
- [ ] Monitor complaint rate, conversion, AOV
- [ ] Iterate on prompts based on real conversations

---

## 20. Known Constraints & Future Improvements

### Current Constraints
1. **Catalog is static** — requires rebuild + redeploy to update products
2. **~93K+ token prompt** — approaching limits for Flash models; consider consolidation or RAG
3. **No CRM webhook** — lead capture (name + email) stays in chat context only
4. **No store database** — "Visit in store" links to RTG locator, can't name specific stores
5. **SHEETS category empty** — bucket wired but no SKUs yet
6. **Per-tab State 3** — multiple tabs = independent interjection schedulers
7. **100-message cap** — chat history silently trims early messages
8. **Single model** — no fallback if OpenRouter model ID is deprecated
9. **Desktop-optimized** — no mobile-specific responsive adjustments
10. **No A/B testing** — prompts are global

### Future Improvements
1. **Filtered catalog injection** — only inject matching rows (cuts 80K tokens to ~5K)
2. **RAG / vector search** — for catalogs > 2,000 rows
3. **CRM webhook** — POST name + email to HubSpot/Salesforce
4. **Store database** — curated JSON for nearest-store cards
5. **Stronger model** — Sonnet/Opus for main chat, Flash for summarize/contextual
6. **Prompt versioning** — A/B test skill variants without rebuild
7. **Analytics pipeline** — track stage transitions, conversion, drop-off points

---

## 21. File Reference

```
roomie-chatbot/
├── SYSTEM_PROMPT.md                 # Universal AI rules (384 lines)
├── ARCHITECTURE.md                  # This file
├── skills/                          # 12 stage-specific skill files
│   ├── greeting.md                  #   28 lines
│   ├── discovery.md                 #   45 lines
│   ├── recommendation.md           #   62 lines
│   ├── comparison.md               #  104 lines
│   ├── closing.md                   #  219 lines
│   ├── complaint.md                 #  192 lines
│   ├── returning.md                 #  102 lines
│   ├── new-session.md               #   50 lines
│   ├── contextual.md               #   75 lines
│   ├── reengagement.md             #   52 lines
│   ├── interjection.md             #  143 lines
│   └── upsell.md                    #  124 lines
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts        # Backend: routing, prompt assembly, OpenRouter
│   │   └── embed/page.tsx           # Iframe entry point
│   ├── components/
│   │   ├── ChatWidget.tsx           # Main component (state machine, 26 refs, 7 state vars)
│   │   ├── ChatMessages.tsx         # Streamdown rendering
│   │   ├── InlineHTML.tsx           # Sandboxed iframe for tiles/cards
│   │   ├── ChatHeader.tsx           # Header with minimize/refresh/share
│   │   └── ChatInput.tsx            # Input field + quick chips
│   ├── hooks/
│   │   └── useProactiveGuard.ts     # Global proactive gate (8 conditions)
│   ├── lib/
│   │   ├── system-prompt.ts         # Prompt builder (loadFile, buildSystemPrompt, context narrative)
│   │   ├── catalog.ts               # getCatalogData, getAccessoryData
│   │   ├── stage-tag.ts             # Stage inference (transient skip logic)
│   │   ├── complaint-detection.ts   # 58 regex patterns
│   │   ├── constants.ts             # WELCOME_MESSAGE
│   │   ├── chat-storage.ts          # localStorage bridge helpers
│   │   └── visitor-profile.ts       # Profile structure + helpers
│   └── data/ (auto-generated, in .gitignore)
│       ├── catalog-raw.ts           # Prebaked catalog (785KB)
│       ├── system-prompt-raw.ts     # Prebaked prompt (27KB)
│       └── skills-raw.ts            # Prebaked skills (60KB)
├── public/
│   └── embed.js                     # Shopify embed script (819 lines)
├── scripts/
│   └── prebuild.js                  # Excel → TypeScript data files
├── updated rtg.xlsx                 # Source catalog (371 rows, 24 columns)
├── package.json                     # Scripts: prebuild.js && next build
└── next.config.ts                   # CSP header for /embed
```
