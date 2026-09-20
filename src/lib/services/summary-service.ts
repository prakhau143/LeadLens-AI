import type { BatchSummary, LeadRecord } from "@/lib/schemas/lead";

export function summarize(
  records: LeadRecord[],
  processedAt: string = new Date().toISOString(),
): BatchSummary {
  const count = (status: LeadRecord["status"]) =>
    records.filter((r) => r.status === status).length;
  return {
    total: records.length,
    extracted: count("extracted"),
    needsReview: count("needs_review"),
    failed: count("failed"),
    duplicates: count("duplicate"),
    processedAt,
  };
}
