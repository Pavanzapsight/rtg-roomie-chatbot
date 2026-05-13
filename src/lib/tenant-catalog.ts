import type { CatalogDataset } from "@/lib/platform-types";

const ACCESSORY_CATEGORY_ORDER = ["LIFESTYLE_BASE", "PROTECTOR", "PILLOW", "SHEETS"] as const;

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[%]/g, " percent ")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function getRowValue(row: Record<string, string>, aliases: string[]): string {
  const lookup = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    lookup.set(normalizeKey(key), String(value ?? "").trim());
  }
  for (const alias of aliases) {
    const value = lookup.get(normalizeKey(alias));
    if (value) return value;
  }
  return "";
}

export function buildFullCatalogSnapshot(dataset: CatalogDataset): string {
  if (dataset.rows.length === 0 || dataset.headers.length === 0) {
    return [
      "# RETRIEVED CATALOG CONTEXT",
      "",
      "- **Intent summary:** Active full catalog snapshot is empty.",
      "- **Applied filters:** full_catalog=yes",
      "- **Result count:** 0",
      "- **Relaxed filters:** no",
      "",
      "## CATALOG DATA",
      "",
      "(none)",
    ].join("\n");
  }

  const headerLine = dataset.headers.join(" | ");
  const separatorLine = dataset.headers.map(() => "---").join(" | ");
  const dataLines = dataset.rows.map((row) =>
    dataset.headers.map((header) => String(row[header] ?? "").trim()).join(" | ")
  );

  return [
    "# RETRIEVED CATALOG CONTEXT",
    "",
    "- **Intent summary:** Active tenant full catalog snapshot.",
    "- **Applied filters:** full_catalog=yes",
    `- **Result count:** ${dataset.rows.length}`,
    "- **Relaxed filters:** no",
    "",
    "## CATALOG DATA",
    "",
    headerLine,
    separatorLine,
    ...dataLines,
  ].join("\n");
}

function rowMatchesCart(row: Record<string, string>, cartItems: string[]): boolean {
  const haystacks = [
    getRowValue(row, ["Customer Description", "Theme", "Sku Number"]),
    getRowValue(row, ["Product Name", "Name"]),
  ]
    .join(" ")
    .toLowerCase();

  return cartItems.some((item) => {
    const needle = item.toLowerCase();
    return haystacks.includes(needle) || needle.includes(haystacks);
  });
}

function formatAccessoryRow(row: Record<string, string>): string {
  const salePrice = getRowValue(row, ["Sale Price", "sale_price"]);
  const regularPrice = getRowValue(row, ["Regular Price", "regular_price"]);
  const price =
    salePrice && regularPrice && salePrice !== regularPrice
      ? `$${salePrice} (reg $${regularPrice})`
      : salePrice
        ? `$${salePrice}`
        : regularPrice
          ? `$${regularPrice}`
          : "n/a";

  const parts = [
    getRowValue(row, ["Customer Description", "Theme", "Product Name"]) || "(no description)",
    getRowValue(row, ["Specialty Brand", "Brand"]) || null,
    getRowValue(row, ["Mattress Size", "Size"]) || null,
    `Price: ${price}`,
    getRowValue(row, ["Discount"]) ? `Discount: ${getRowValue(row, ["Discount"])}` : null,
    getRowValue(row, ["Discount %", "Discount Percent"]) ? `Discount %: ${getRowValue(row, ["Discount %", "Discount Percent"])}` : null,
    getRowValue(row, ["Sku Number", "SKU"]) ? `SKU: ${getRowValue(row, ["Sku Number", "SKU"])}` : null,
    getRowValue(row, ["Image 1", "Image"]) ? `Image: ${getRowValue(row, ["Image 1", "Image"])}` : null,
    getRowValue(row, ["Product Link", "Link"]) ? `Link: ${getRowValue(row, ["Product Link", "Link"])}` : null,
    getRowValue(row, ["Shopify Variant ID", "Variant ID"]) ? `Shopify Variant ID: ${getRowValue(row, ["Shopify Variant ID", "Variant ID"])}` : null,
  ].filter(Boolean);

  return `- ${parts.join(" | ")}`;
}

export function buildAccessoryCatalog(
  rows: Record<string, string>[],
  cartItems?: string[] | null
): string {
  const cart = (cartItems ?? []).map((item) => item.trim()).filter(Boolean);
  const sections: string[] = ["# ACCESSORY CATALOG", ""];
  sections.push(
    "All accessory products come from the tenant's active catalog snapshot. Use the Shopify Variant ID for Add to Cart exactly as you would for a mattress.",
    ""
  );

  for (const category of ACCESSORY_CATEGORY_ORDER) {
    const matches = rows
      .filter((row) => getRowValue(row, ["Category"]).toUpperCase() === category)
      .filter((row) => !rowMatchesCart(row, cart))
      .slice(0, 3);

    if (matches.length === 0) continue;

    if (category === "LIFESTYLE_BASE") {
      sections.push("## LIFESTYLE BASES");
      sections.push(
        "Best suggested for customers with back discomfort, hip discomfort, reflux, snoring, or lifestyle upgrade (reading, TV, elevated legs). Match size to the customer's mattress.",
        ""
      );
    } else if (category === "PROTECTOR") {
      sections.push("## MATTRESS PROTECTORS");
      sections.push(
        "Match the protector size to the customer's mattress size and highlight hygiene, spill, and stain protection.",
        ""
      );
    } else if (category === "PILLOW") {
      sections.push("## PILLOWS");
      sections.push(
        "Pick loft/shape guidance based on sleep position and temperature needs when the catalog provides that information.",
        ""
      );
    } else if (category === "SHEETS") {
      sections.push("## SHEETS");
      sections.push("Match sheet size to the customer's mattress size.", "");
    }

    sections.push(...matches.map(formatAccessoryRow), "");
  }

  return sections.join("\n");
}
