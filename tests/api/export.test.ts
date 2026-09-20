// @vitest-environment node
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { POST } from "@/app/api/export/route";
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
];

const summary: BatchSummary = {
  total: 1,
  extracted: 1,
  needsReview: 0,
  failed: 0,
  duplicates: 0,
  processedAt: "2026-01-01T00:00:00.000Z",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/export", () => {
  it("returns a valid xlsx workbook for a well-formed payload", async () => {
    const response = await POST(makeRequest({ leads: records, summary }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml");

    const buffer = Buffer.from(await response.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // exceljs's bundled Buffer typings and this project's @types/node
    // disagree structurally on the generic Buffer param even though both
    // describe the same real Node Buffer at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (workbook.xlsx as any).load(buffer);
    expect(workbook.getWorksheet("Leads")).toBeDefined();
  });

  it("rejects a malformed payload with 400", async () => {
    const response = await POST(makeRequest({ leads: "not-an-array" }));
    expect(response.status).toBe(400);
  });
});
