import ExcelJS from "exceljs";
import { LEAD_TABLE_COLUMNS, type BatchSummary, type LeadRecord } from "@/lib/schemas/lead";

export async function buildWorkbook(
  leads: LeadRecord[],
  summary: BatchSummary,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LeadLens AI";
  workbook.created = new Date();

  const leadsSheet = workbook.addWorksheet("Leads");
  leadsSheet.columns = LEAD_TABLE_COLUMNS.map((col) => ({
    header: col.label,
    key: col.key,
    width: 22,
  }));
  leadsSheet.getRow(1).font = { bold: true };

  // Failed/duplicate cards have no lead data; exporting them would add blank rows.
  for (const record of leads.filter(
    (r) => r.status === "extracted" || r.status === "needs_review",
  )) {
    leadsSheet.addRow({
      first_name: record.lead.first_name ?? "",
      last_name: record.lead.last_name ?? "",
      job_title: record.lead.job_title ?? "",
      company: record.lead.company ?? "",
      location: record.lead.location ?? "",
      phone: record.lead.phone ?? "",
      email: record.lead.email ?? "",
    });
  }

  const summarySheet = workbook.addWorksheet("Processing Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Value", key: "value", width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRows([
    { metric: "Total Cards", value: summary.total },
    { metric: "Successfully Extracted", value: summary.extracted },
    { metric: "Needs Review", value: summary.needsReview },
    { metric: "Failed", value: summary.failed },
    { metric: "Duplicates Skipped", value: summary.duplicates },
    { metric: "Processed At", value: summary.processedAt },
  ]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
