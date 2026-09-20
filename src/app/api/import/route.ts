import { NextResponse } from "next/server";
import {
  ImportError,
  MAX_IMPORT_BYTES,
  parseLeadWorkbook,
} from "@/lib/services/import-service";
import { summarize } from "@/lib/services/summary-service";
import { log } from "@/lib/utils/logger";

export const runtime = "nodejs";

const MULTIPART_OVERHEAD_BYTES = 256 * 1024;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_IMPORT_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return fail("That file is too large (5 MB maximum).", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Invalid form data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("No file was uploaded.", 400);
  if (file.size > MAX_IMPORT_BYTES) return fail("That file is too large (5 MB maximum).", 413);

  const buffer = Buffer.from(await file.arrayBuffer());
  // An .xlsx is a zip archive. Check the bytes rather than trusting the name or MIME type.
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
    return fail("That is not an .xlsx workbook. (Older .xls files are not supported.)", 400);
  }

  try {
    const records = await parseLeadWorkbook(buffer, file.name || "import.xlsx");
    log("info", "import_completed", { rows: records.length });
    return NextResponse.json({ records, summary: summarize(records) });
  } catch (error) {
    if (error instanceof ImportError) return fail(error.message, 400);
    log("error", "import_failed", {
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
    return fail("Could not read that Excel file.", 400);
  }
}
