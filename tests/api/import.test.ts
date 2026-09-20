// @vitest-environment node
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { POST } from "@/app/api/import/route";
import { buildWorkbook } from "@/lib/services/excel-service";
import type { LeadRecord } from "@/lib/schemas/lead";

const HEADERS = ["First Name", "Last Name", "Position / Job Title", "Company", "Location", "Phone Number", "Email Address"];

async function xlsxFile(build: (ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook) => void, name = "leads.xlsx") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leads");
  build(ws, wb);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new File([new Uint8Array(buffer)], name);
}

async function post(file: File | null, extra?: Record<string, string>) {
  const form = new FormData();
  if (file) form.append("file", file);
  for (const [k, v] of Object.entries(extra ?? {})) form.append(k, v);
  return POST(new Request("http://localhost/api/import", { method: "POST", body: form }));
}

const exported: LeadRecord[] = [
  {
    id: "a", sourceFileName: "morgan.png", status: "extracted", failureReason: null,
    lead: { first_name: "Morgan", last_name: "Maxwell", job_title: "General Manager", company: "Liceria & Co.",
      location: "123 Anywhere St., Any City, ST 12345", phone: "+123-456-7890", email: "hello@reallygreatsite.com" },
  },
  {
    id: "b", sourceFileName: "daniel.jpg", status: "needs_review", failureReason: null,
    lead: { first_name: "Daniel", last_name: "Okafor", job_title: "Head of Partnerships", company: "LUMEN FREIGHT",
      location: null, phone: null, email: "daniel.okafor@lumenfreight.com" },
  },
  {
    id: "c", sourceFileName: "broken.jpg", status: "failed", failureReason: "x",
    lead: { first_name: null, last_name: null, job_title: null, company: null, location: null, phone: null, email: null },
  },
];

describe("POST /api/import", () => {
  it("round-trips a workbook produced by the app's own export", async () => {
    const buffer = await buildWorkbook(exported, {
      total: 3, extracted: 1, needsReview: 1, failed: 1, duplicates: 0, processedAt: "2026-01-01T00:00:00.000Z",
    });
    const res = await post(new File([new Uint8Array(buffer)], "leadlens-export.xlsx"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.records).toHaveLength(2); // the failed record is not in the export
    expect(body.records.map((r: LeadRecord) => r.lead)).toEqual(exported.slice(0, 2).map((r) => r.lead));
    expect(body.records.map((r: LeadRecord) => r.status)).toEqual(["extracted", "needs_review"]);
    expect(body.summary).toMatchObject({ total: 2, extracted: 1, needsReview: 1, failed: 0 });
    expect(body.records[0].sourceFileName).toBe("leadlens-export.xlsx · row 2");
  });

  it("uses a formula's value, never the formula text, and keeps numeric phones", async () => {
    const file = await xlsxFile((ws) => {
      ws.addRow(HEADERS);
      ws.addRow(["Ann", "Lee", null, { formula: '"Acme"&" Inc"', result: "Acme Inc" }, null, 9876543210, "ann@acme.com"]);
    });
    const body = await (await post(file)).json();
    expect(body.records[0].lead).toMatchObject({ company: "Acme Inc", phone: "9876543210" });
    expect(JSON.stringify(body)).not.toContain('"Acme"&');
  });

  it("recomputes status from the data and skips blank rows", async () => {
    const file = await xlsxFile((ws) => {
      ws.addRow(HEADERS);
      ws.addRow(["A", "B", "C", "D", "E", "+1 555 0100", "not-an-email"]); // full but malformed email
      ws.addRow([null, null, null, null, null, null, null]);
      ws.addRow(["  ", "", null, null, null, null, null]);
      ws.addRow(["Zed", null, null, null, null, null, "zed@z.co"]);
    });
    const body = await (await post(file)).json();
    expect(body.records).toHaveLength(2);
    expect(body.records.map((r: LeadRecord) => r.status)).toEqual(["needs_review", "needs_review"]);
  });

  it("accepts friendly header spellings and a header that is not on row 1", async () => {
    const file = await xlsxFile((ws) => {
      ws.addRow(["My leads"]);
      ws.addRow(["first name", "LAST NAME", "Position", "company", "location", "Phone", "Email"]);
      ws.addRow(["Sam", "Ng", "CTO", "Nova", "Oslo", "+47 1", "sam@nova.no"]);
    });
    const body = await (await post(file)).json();
    expect(body.records[0].lead).toMatchObject({ first_name: "Sam", job_title: "CTO", email: "sam@nova.no" });
    expect(body.records[0].status).toBe("extracted");
  });

  it("reads the first sheet when there is no sheet named Leads", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(HEADERS);
    ws.addRow(["Kim", "Park", "PM", "Orbit", "Seoul", "+82 1", "kim@orbit.kr"]);
    const file = new File([new Uint8Array(Buffer.from(await wb.xlsx.writeBuffer()))], "x.xlsx");
    expect((await (await post(file)).json()).records).toHaveLength(1);
  });

  it("rejects a workbook with no recognisable columns, naming the expected ones", async () => {
    const file = await xlsxFile((ws) => {
      ws.addRow(["Foo", "Bar"]);
      ws.addRow([1, 2]);
    });
    const res = await post(file);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Email Address");
  });

  it("rejects a header-only sheet", async () => {
    const res = await post(await xlsxFile((ws) => ws.addRow(HEADERS)));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no lead rows/i);
  });

  it("checks the bytes, not the file name or type", async () => {
    const fake = new File([new TextEncoder().encode("name,email\nA,a@b.co")], "leads.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const res = await post(fake);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not an \.xlsx/i);
  });

  it("rejects a zip that is not a workbook without leaking internals", async () => {
    const notXlsx = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8])], "x.xlsx");
    const res = await post(notXlsx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/could not be read|Could not read/i);
  });

  it("rejects an oversized file with 413", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 10)], "big.xlsx");
    expect((await post(big)).status).toBe(413);
  });

  it("rejects a missing file", async () => {
    expect((await post(null)).status).toBe(400);
  });

  it("rejects more than 1000 leads", async () => {
    const file = await xlsxFile((ws) => {
      ws.addRow(HEADERS);
      for (let i = 0; i < 1001; i++) ws.addRow([`F${i}`, "L", null, null, null, null, null]);
    });
    const res = await post(file);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/more than 1000/);
  });
});
