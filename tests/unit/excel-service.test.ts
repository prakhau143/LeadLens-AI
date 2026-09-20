import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook } from "@/lib/services/excel-service";
import type { BatchSummary, LeadRecord } from "@/lib/schemas/lead";

const records: LeadRecord[] = [
  {
    id: "1",
    sourceFileName: "card1.jpg",
    status: "extracted",
    failureReason: null,
    lead: {
      first_name: "Rahul",
      last_name: "Sharma",
      job_title: "CEO",
      company: "ABC Corp",
      location: "Delhi",
      phone: "+91 9876543210",
      email: "rahul@abc.com",
    },
  },
  {
    id: "2",
    sourceFileName: "card2.jpg",
    status: "needs_review",
    failureReason: null,
    lead: {
      first_name: "Sarah",
      last_name: null,
      job_title: "CTO",
      company: "XYZ Ltd",
      location: null,
      phone: null,
      email: "sarah@xyz.com",
    },
  },
];

const summary: BatchSummary = {
  total: 2,
  extracted: 1,
  needsReview: 1,
  failed: 0,
  duplicates: 0,
  processedAt: "2026-01-01T00:00:00.000Z",
};

describe("buildWorkbook", () => {
  it("produces a workbook with a Leads sheet and a Processing Summary sheet", async () => {
    const buffer = await buildWorkbook(records, summary);

    const workbook = new ExcelJS.Workbook();
    // exceljs's bundled Buffer typings and this project's @types/node
    // disagree structurally on the generic Buffer param even though both
    // describe the same real Node Buffer at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (workbook.xlsx as any).load(buffer);

    const leadsSheet = workbook.getWorksheet("Leads");
    const summarySheet = workbook.getWorksheet("Processing Summary");

    expect(leadsSheet).toBeDefined();
    expect(summarySheet).toBeDefined();

    const headers = (leadsSheet!.getRow(1).values as unknown[]).slice(1);
    expect(headers).toEqual([
      "First Name",
      "Last Name",
      "Position / Job Title",
      "Company",
      "Location",
      "Phone Number",
      "Email Address",
    ]);
    expect(leadsSheet!.getRow(1).getCell(1).value).toBe("First Name");
    expect(leadsSheet!.rowCount).toBe(records.length + 1);
    expect(leadsSheet!.getRow(2).getCell(1).value).toBe("Rahul");

    expect(summarySheet!.getRow(2).getCell(1).value).toBe("Total Cards");
    expect(summarySheet!.getRow(2).getCell(2).value).toBe(2);
  });
});

describe("buildWorkbook with untrusted cell content", () => {
  it("writes formula-looking text as plain strings, never as formulas", async () => {
    const hostile: LeadRecord = {
      id: "x",
      sourceFileName: "evil.jpg",
      status: "extracted",
      failureReason: null,
      lead: {
        first_name: "=1+1",
        last_name: "@SUM(A1)",
        job_title: "-2+3",
        company: '=HYPERLINK("http://evil.test","x")',
        location: null,
        phone: "+91 98450 12345",
        email: null,
      },
    };
    const buffer = await buildWorkbook([hostile], summary);
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (workbook.xlsx as any).load(buffer);
    const row = workbook.getWorksheet("Leads")!.getRow(2);

    for (const col of [1, 2, 3, 4]) {
      const cell = row.getCell(col);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(typeof cell.value).toBe("string");
    }
    expect(row.getCell(1).value).toBe("=1+1");
  });
});

describe("buildWorkbook row selection", () => {
  it("omits failed and duplicate cards from the Leads sheet", async () => {
    const blank = { first_name: null, last_name: null, job_title: null, company: null, location: null, phone: null, email: null };
    const mixed: LeadRecord[] = [
      records[0],
      { id: "f", sourceFileName: "bad.jpg", status: "failed", failureReason: "x", lead: blank },
      { id: "d", sourceFileName: "dup.jpg", status: "duplicate", failureReason: null, lead: blank },
      records[1],
    ];
    const buffer = await buildWorkbook(mixed, { ...summary, total: 4, failed: 1, duplicates: 1 });
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (workbook.xlsx as any).load(buffer);
    const sheet = workbook.getWorksheet("Leads")!;
    expect(sheet.rowCount).toBe(3); // header + 2 real leads, no blank rows
    expect(sheet.getRow(3).getCell(1).value).toBe("Sarah");
  });
});
