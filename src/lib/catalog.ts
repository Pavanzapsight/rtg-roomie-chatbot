import { readFileSync } from "fs";
import { join } from "path";
import { parseExcelBuffer } from "./excel-parser";

let cachedCatalog: string | null = null;

export function getCatalogData(): string {
  if (cachedCatalog) return cachedCatalog;

  const filePath = join(process.cwd(), "Mattress SKUS RTG.xlsx");
  const buffer = readFileSync(filePath);
  const parsed = parseExcelBuffer(buffer.buffer as ArrayBuffer);
  cachedCatalog = parsed.rawText;
  return cachedCatalog;
}
