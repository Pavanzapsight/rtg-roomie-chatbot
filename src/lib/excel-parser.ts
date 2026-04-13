import * as XLSX from "xlsx";

export interface ParsedCatalog {
  headers: string[];
  rows: Record<string, string>[];
  rawText: string;
}

export function parseExcelBuffer(buffer: ArrayBuffer): ParsedCatalog {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });

  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

  // Build a plain-text representation for the system prompt
  const headerLine = headers.join(" | ");
  const separator = headers.map(() => "---").join(" | ");
  const dataLines = jsonData.map((row) =>
    headers.map((h) => String(row[h] ?? "").trim()).join(" | ")
  );

  const rawText = [headerLine, separator, ...dataLines].join("\n");

  return { headers, rows: jsonData, rawText };
}
