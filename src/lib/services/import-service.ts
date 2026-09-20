import ExcelJS from "exceljs";
import { nanoid } from "nanoid";
import { LEAD_TABLE_COLUMNS, type Lead, type LeadRecord } from "@/lib/schemas/lead";
import { deriveStatus, normalizeLead } from "@/lib/services/validation-service";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;

/** A problem with the uploaded file that is safe to show to the user. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

const normalizeHeader = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

// The exported labels, plus a few obvious spellings from hand-edited sheets.
const HEADER_TO_KEY = new Map<string, keyof Lead>([
  ...LEAD_TABLE_COLUMNS.map((c) => [normalizeHeader(c.label), c.key] as const),
  ["job title", "job_title"],
  ["position", "job_title"],
  ["title", "job_title"],
  ["phone", "phone"],
  ["email", "email"],
]);

/** Excel cells can hold numbers, formulas, rich text, hyperlinks... reduce to plain text. */
function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue); // formula: use its value, never the formula
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim() || null;
    if ("text" in value) return cellText(value.text as ExcelJS.CellValue); // hyperlink
  }
  return null; // error cells etc.
}

/**
 * Reads a LeadLens-style workbook (the `Leads` sheet, or the first sheet) into lead
 * records. Statuses are recomputed from the data, so nothing in the file is trusted
 * to say "extracted".
 */
export async function parseLeadWorkbook(buffer: Buffer, fileName: string): Promise<LeadRecord[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs types this as the pre-Node-22 Buffer; runtime accepts any Buffer.
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new ImportError("This file could not be read as an .xlsx workbook.");
  }

  const sheet = workbook.getWorksheet("Leads") ?? workbook.worksheets[0];
  if (!sheet) throw new ImportError("The workbook has no sheets.");

  // Find the header row within the first few rows.
  let headerRow = 0;
  const columns = new Map<number, keyof Lead>();
  for (let r = 1; r <= Math.min(5, sheet.rowCount) && headerRow === 0; r++) {
    const found = new Map<number, keyof Lead>();
    sheet.getRow(r).eachCell((cell, col) => {
      const text = cellText(cell.value);
      const key = text ? HEADER_TO_KEY.get(normalizeHeader(text)) : undefined;
      if (key) found.set(col, key);
    });
    if (found.size >= 2) {
      headerRow = r;
      found.forEach((key, col) => columns.set(col, key));
    }
  }
  if (headerRow === 0) {
    throw new ImportError(
      `No lead columns found. Expected headers such as: ${LEAD_TABLE_COLUMNS.map((c) => c.label).join(", ")}.`,
    );
  }

  const records: LeadRecord[] = [];
  let tooMany = false;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow || tooMany) return;
    const raw: Lead = {
      first_name: null, last_name: null, job_title: null, company: null,
      location: null, phone: null, email: null,
    };
    columns.forEach((key, col) => {
      raw[key] = cellText(row.getCell(col).value);
    });
    const lead = normalizeLead(raw);
    if (Object.values(lead).every((v) => v === null)) return; // blank row
    if (records.length >= MAX_IMPORT_ROWS) {
      tooMany = true;
      return;
    }
    records.push({
      id: nanoid(),
      sourceFileName: `${fileName} · row ${rowNumber}`,
      status: deriveStatus(lead),
      lead,
      failureReason: null,
    });
  });

  if (tooMany) throw new ImportError(`The sheet has more than ${MAX_IMPORT_ROWS} leads; split it and import in parts.`);
  if (records.length === 0) throw new ImportError("The sheet has a header row but no lead rows.");
  return records;
}
