import { readFileSync } from "fs";
import { join } from "path";
import * as XLSX from "xlsx";
import { parseExcelBuffer } from "./excel-parser";

/** Mattress catalog workbook at repo root (Upload sheet: SKU, pricing, specs, links, etc.). */
const CATALOG_WORKBOOK = "updated rtg.xlsx";
const CATALOG_SHEET = "Upload sheet";
const ACCESSORY_SHEET = "Sheet3";

let cachedCatalog: string | null = null;
let cachedAccessories: string | null = null;

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

export function getAccessoryData(): string {
  if (cachedAccessories) return cachedAccessories;

  const filePath = join(process.cwd(), CATALOG_WORKBOOK);
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer.buffer as ArrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[ACCESSORY_SHEET];
  if (!sheet) return "";

  type Row = (string | number | null)[];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: null }) as Row[];

  const RELEVANT = new Set(["MATTRESS PROTECTORS", "PILLOWS"]);
  let currentCat = "";
  const sections: Record<string, string[]> = {};

  for (const row of rows.slice(1)) {
    // Category header row has value in column 0
    if (row[0] && typeof row[0] === "string" && row[0].trim()) {
      currentCat = row[0].trim();
      continue;
    }
    if (!RELEVANT.has(currentCat)) continue;
    const sku = row[1];
    const desc = row[2];
    const salePrice = row[3];
    const brand = row[5];
    const img = row[6];
    const link = row[7]; // "Image 2" column contains the product link
    if (!desc || !sku) continue;
    if (!sections[currentCat]) sections[currentCat] = [];
    sections[currentCat].push(
      `${desc} | Brand: ${brand} | Price: $${salePrice} | SKU: ${sku} | Image: ${img} | Link: ${link}`
    );
  }

  const out: string[] = ["# ACCESSORY CATALOG", ""];

  if (sections["MATTRESS PROTECTORS"]?.length) {
    out.push("## MATTRESS PROTECTORS");
    out.push("Three tiers — always match size to the customer's mattress size:");
    out.push("- iProtect: Entry-level waterproof protection. Reliable, affordable.");
    out.push("- Dri-Tec: Moisture-wicking, breathable construction. Recommended default for most customers.");
    out.push("- Ver-Tex: Premium breathable cover with active temperature management. Best for customers who sleep hot.");
    out.push("");
    out.push(...sections["MATTRESS PROTECTORS"]);
    out.push("");
  }

  if (sections["PILLOWS"]?.length) {
    out.push("## PILLOWS");
    out.push("BEDGEAR loft number maps directly to the customer's sleep position:");
    out.push("- 0.0 = Stomach sleepers (flattest loft)");
    out.push("- 1.0 = Side sleepers, lighter build");
    out.push("- 2.0 = Side sleepers, average or heavier build (default for side sleepers)");
    out.push("- 3.0 = Back sleepers");
    out.push("- Combo sleepers → use 2.0 as default");
    out.push("Night Ice series: Prioritize for customers who sleep hot — temperature management fabric.");
    out.push("Storm series: All-around performance pillow. Good default.");
    out.push("Aspen series: Entry-level BEDGEAR performance pillow.");
    out.push("Tempurpedic Breeze: Premium, temperature-managed foam. Best for hot sleepers at high budget.");
    out.push("Tempurpedic Adapt: Premium conforming foam for back/side sleepers.");
    out.push("Casper Snow: Temperature-managed foam at mid price point.");
    out.push("");
    out.push(...sections["PILLOWS"]);
  }

  cachedAccessories = out.join("\n");
  return cachedAccessories;
}
