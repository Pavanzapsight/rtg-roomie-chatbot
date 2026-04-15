import { readFileSync } from "fs";
import { join } from "path";
import { parseExcelBuffer } from "./excel-parser";

/**
 * Single source of truth: the `Upload sheet` in `updated rtg.xlsx`.
 *
 * Every product — mattresses, adjustable bases, pillows, protectors, frames —
 * lives in this one sheet, each row categorized via the `Category` column
 * (MATTRESS / ADJUSTABLE_BASE / PILLOW / PROTECTOR / FRAME). Every row with a
 * Product Link also has a `Shopify Variant ID` extracted from the URL so
 * Add-to-Cart works uniformly for any category.
 */
const CATALOG_WORKBOOK = "updated rtg.xlsx";
const CATALOG_SHEET = "Upload sheet";

let cachedCatalog: string | null = null;
let cachedAccessories: string | null = null;

/** Full catalog as markdown for the system prompt (all categories). */
export function getCatalogData(): string {
  if (cachedCatalog) return cachedCatalog;

  const filePath = join(process.cwd(), CATALOG_WORKBOOK);
  const buffer = readFileSync(filePath);
  const parsed = parseExcelBuffer(buffer.buffer as ArrayBuffer, {
    sheetName: CATALOG_SHEET,
  });
  cachedCatalog = parsed.rawText;
  return cachedCatalog;
}

/**
 * Accessory-focused slice of the SAME catalog (no separate sheet). Used
 * during the closing / upsell stages so the prompt gets cross-sell context
 * without re-reading the full mattress table.
 *
 * Groups rows by the `Category` column and outputs readable sections for
 * PROTECTOR, PILLOW, FRAME, ADJUSTABLE_BASE. Each row carries the same
 * Shopify Variant ID from the Upload sheet, so Add-to-Cart works the
 * same way for any accessory as it does for a mattress.
 */
export function getAccessoryData(): string {
  if (cachedAccessories) return cachedAccessories;

  const filePath = join(process.cwd(), CATALOG_WORKBOOK);
  const buffer = readFileSync(filePath);
  const parsed = parseExcelBuffer(buffer.buffer as ArrayBuffer, {
    sheetName: CATALOG_SHEET,
  });

  // Bucket rows by Category. We re-render each as a compact markdown line so
  // the AI can pluck them into product cards during cross-sell.
  const buckets: Record<string, string[]> = {
    PROTECTOR: [],
    PILLOW: [],
    FRAME: [],
    ADJUSTABLE_BASE: [],
  };

  for (const row of parsed.rows) {
    const cat = String(row["Category"] || "").trim();
    if (!cat || cat === "MATTRESS" || !(cat in buckets)) continue;
    const desc = String(row["Customer Description"] || "").trim();
    const sku = String(row["Sku Number"] || "").trim();
    const brand = String(row["Specialty Brand"] || "").trim();
    const salePrice = String(row["Sale Price"] || "").trim();
    const regPrice = String(row["Regular Price"] || "").trim();
    const size = String(row["Mattress Size"] || "").trim();
    const img = String(row["Image 1"] || "").trim();
    const link = String(row["Product Link"] || "").trim();
    const variantId = String(row["Shopify Variant ID"] || "").trim();
    if (!desc && !sku) continue;
    const price =
      salePrice && regPrice && salePrice !== regPrice
        ? `$${salePrice} (reg $${regPrice})`
        : salePrice
          ? `$${salePrice}`
          : regPrice
            ? `$${regPrice}`
            : "n/a";
    const parts = [
      desc || "(no description)",
      brand ? `Brand: ${brand}` : null,
      size ? `Size: ${size}` : null,
      `Price: ${price}`,
      sku ? `SKU: ${sku}` : null,
      img ? `Image: ${img}` : null,
      link ? `Link: ${link}` : null,
      variantId ? `Shopify Variant ID: ${variantId}` : null,
    ].filter(Boolean);
    buckets[cat].push("- " + parts.join(" | "));
  }

  const out: string[] = ["# ACCESSORY CATALOG", ""];
  out.push(
    "All accessory products come from the same Upload sheet as the mattresses, filtered by the `Category` column. Use the Shopify Variant ID for Add to Cart exactly as you would for a mattress.",
    ""
  );

  if (buckets.PROTECTOR.length) {
    out.push("## MATTRESS PROTECTORS");
    out.push(
      "Three BEDGEAR tiers — always match the size to the customer's mattress size:",
      "- iProtect: Entry-level waterproof protection. Reliable, affordable.",
      "- Dri-Tec: Moisture-wicking, breathable. Default for most customers.",
      "- Ver-Tex: Premium breathable cover with active temperature management. Best for hot sleepers.",
      ""
    );
    out.push(...buckets.PROTECTOR);
    out.push("");
  }

  if (buckets.PILLOW.length) {
    out.push("## PILLOWS");
    out.push(
      "BEDGEAR loft number maps to sleep position:",
      "- 0.0 = Stomach sleepers (flattest)",
      "- 1.0 = Side sleepers, lighter build",
      "- 2.0 = Side sleepers, average/heavier (default for side sleepers)",
      "- 3.0 = Back sleepers",
      "- Combo sleepers → 2.0 default",
      "Night Ice: hot sleepers. Storm: all-around. Aspen: entry-level. Tempurpedic Breeze: premium hot-sleeper. Tempurpedic Adapt: premium conforming. Casper Snow: temperature-managed at mid-price.",
      ""
    );
    out.push(...buckets.PILLOW);
    out.push("");
  }

  if (buckets.FRAME.length) {
    out.push("## FRAMES");
    out.push(
      "Basic bed frame for customers who need a foundation along with their mattress.",
      ""
    );
    out.push(...buckets.FRAME);
    out.push("");
  }

  if (buckets.ADJUSTABLE_BASE.length) {
    out.push("## ADJUSTABLE BASES");
    out.push(
      "Best suggested for customers with back pain, hip pain, reflux, snoring, or lifestyle upgrade (reading, TV, elevated legs). Match size to the customer's mattress.",
      "Tier guide:",
      "- BaseLogic Silver: Entry-level adjustable (head/foot articulation).",
      "- BaseLogic Platinum: Mid-tier (adds massage, USB, wireless remote).",
      "- Tempur-Ergo 3.0 / 3.0 Smart / ProSmart: Premium tier.",
      "- Adapt Pro-LO / Pro-HI / ProAdjust: Tempur-Pedic-compatible premium bases.",
      "- RTG-Sleep 2900 / 3900 / 5900: RTG's own performance tier.",
      "- EASE 4.0: Stearns & Foster base option.",
      ""
    );
    out.push(...buckets.ADJUSTABLE_BASE);
    out.push("");
  }

  cachedAccessories = out.join("\n");
  return cachedAccessories;
}
