import { readFileSync } from "fs";
import { join } from "path";
import { parseExcelBuffer } from "./excel-parser";

/** Mattress catalog workbook at repo root (Upload sheet: SKU, pricing, specs, links, etc.). */
const CATALOG_WORKBOOK = "updated rtg.xlsx";
const CATALOG_SHEET = "Upload sheet";

let cachedCatalog: string | null = null;

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
