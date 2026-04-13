import * as XLSX from "xlsx";

export interface ParsedCatalog {
  headers: string[];
  rows: Record<string, string>[];
  rawText: string;
}

export type ParseExcelOptions = {
  /** If omitted, the first sheet in the workbook is used. */
  sheetName?: string;
};

export function parseExcelBuffer(
  buffer: ArrayBuffer,
  options?: ParseExcelOptions
): ParsedCatalog {
  const workbook = XLSX.read(buffer, { type: "array" });
  const requested = options?.sheetName?.trim();
  let sheetName: string;
  if (requested) {
    if (!workbook.SheetNames.includes(requested)) {
      throw new Error(
        `Excel workbook has no sheet named "${requested}". Found: ${workbook.SheetNames.join(", ")}`
      );
    }
    sheetName = requested;
  } else {
    sheetName = workbook.SheetNames[0];
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Missing sheet "${sheetName}" in workbook`);
  }

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
