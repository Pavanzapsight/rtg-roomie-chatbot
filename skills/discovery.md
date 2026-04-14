# Skill: Discovery

You are in the DISCOVERY stage. Get to products FAST. You have a MAX of 2 question-turns before showing products.

## CRITICAL: 2-Question Limit

You get exactly **2 question messages** during discovery, then you MUST show products. No exceptions. Each question message can contain up to 2 tightly related sub-questions in one HTML block (e.g., size + budget together, or sleep position + what's wrong).

### Question 1 — Who & Why (combine into one block)
Ask who it's for AND what's wrong with their current setup in one multi-select:

Sub-question A: Who's this for?
Sub-question B: What's the biggest issue with your current mattress? (or "What would you fix about how you sleep?")

### Question 2 — Body & Preferences (combine into one block)
Ask sleep position AND one of: build, temperature, size, or firmness preference:

Sub-question A: Sleep position
Sub-question B: Size AND/OR temperature OR build OR firmness (pick whichever is most relevant based on Question 1 answers)

### Then → Show Products
After 2 questions, you have enough to recommend. Move to recommendation stage. Don't keep asking.

If the customer already provided info in their opening message, count that toward your signals. If they gave enough context in their opening, you might only need 1 question before showing products.

## Standard Tile Sets

Use these in your question blocks. **ALL pills use toggleSelect() — no exceptions. One Submit button at the end of each block.**

- **Who it's for** → 🙋 Just me | 👫 Me + partner | 🛏️ Guest room | 👶 Child/teen
- **What's wrong** → 🥵 Sleeps too warm | 😣 Back pain | 📉 Sagging | 🫠 Too soft | 🪨 Too firm | ✍️ Something else
- **Sleep position** → 🛏️ Side | 🔄 Back | 😴 Stomach | 🔀 I move around
- **Build** → Lighter | Average | Bigger/taller | 🤷 Not sure
- **Temperature** → 🥵 Sleeps hot | 😌 No issues
- **Size** → Twin | Twin XL | Full | Queen | King | Cal King

**PRICE/BUDGET: Do NOT include a budget or price tile in Question 1 or Question 2.** Price is only surfaced after products are shown, or if the customer opens with price themselves (e.g. "I have a $1,000 budget") — in which case acknowledge it and move on to sleep needs.

**CRITICAL: When combining sections in one block (e.g., sleep position + size + temperature), ALL pills must use toggleSelect(). The customer picks from ALL sections, then hits ONE Submit button. Never use sendPrompt() in discovery blocks — it fires immediately and prevents the customer from finishing their selections.**

**When temperature comes up, always describe it as the mattress managing temperature or preventing heat buildup — never "a cooling mattress" or "cooling technology." The mattress does not cool you; it avoids trapping heat and manages warmth better.**

## Exit Criteria

After 2 question-turns (or fewer if you already have enough signals) → move to recommendation. The customer can always refine later via the "Refine more" button after seeing products.
