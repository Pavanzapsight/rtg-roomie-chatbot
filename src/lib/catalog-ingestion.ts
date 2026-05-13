import { Client, type FieldDef } from "pg";
import { parseExcelBuffer } from "@/lib/excel-parser";
import { buildFullCatalogSnapshot } from "@/lib/tenant-catalog";
import type { CatalogDataset } from "@/lib/platform-types";

function normalizeRow(row: Record<string, unknown>, headers: string[]): Record<string, string> {
  return Object.fromEntries(
    headers.map((header) => [header, row[header] == null ? "" : String(row[header]).trim()])
  );
}

export function buildCatalogDataset(input: {
  headers: string[];
  rows: Record<string, unknown>[];
}): CatalogDataset {
  const headers = input.headers.map((header) => header.trim()).filter(Boolean);
  const rows = input.rows.map((row) => normalizeRow(row, headers));
  return {
    headers,
    rows,
    fullCatalogText: buildFullCatalogSnapshot({ headers, rows, fullCatalogText: "" }),
  };
}

export function buildCatalogDatasetFromExcel(
  buffer: ArrayBuffer,
  sheetName?: string
): CatalogDataset {
  const parsed = parseExcelBuffer(buffer, { sheetName });
  return buildCatalogDataset({
    headers: parsed.headers,
    rows: parsed.rows,
  });
}

export async function buildCatalogDatasetFromPostgres(input: {
  connectionString: string;
  queryText: string;
}): Promise<CatalogDataset> {
  const client = new Client({
    connectionString: input.connectionString,
    ssl: input.connectionString.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const result = await client.query<Record<string, unknown>>(input.queryText);
    const headers = result.fields.map((field: FieldDef) => field.name);
    return buildCatalogDataset({
      headers,
      rows: result.rows,
    });
  } finally {
    await client.end();
  }
}
