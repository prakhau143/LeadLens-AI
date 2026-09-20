import { LEAD_TABLE_COLUMNS, type Lead } from "@/lib/schemas/lead";

/**
 * How many of the 7 fields have a value. This is a plain field count, not a
 * model confidence: the VLM does not report calibrated confidence.
 */
export function leadCompleteness(lead: Lead): { filled: number; total: number } {
  const filled = LEAD_TABLE_COLUMNS.filter(
    (col) => (lead[col.key] ?? "").trim() !== "",
  ).length;
  return { filled, total: LEAD_TABLE_COLUMNS.length };
}
