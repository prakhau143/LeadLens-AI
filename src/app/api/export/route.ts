import { NextResponse } from "next/server";
import { ExportRequestSchema } from "@/lib/schemas/extraction";
import { buildWorkbook } from "@/lib/services/excel-service";
import { log } from "@/lib/utils/logger";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ExportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid export payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await buildWorkbook(parsed.data.leads, parsed.data.summary);
  } catch (error) {
    log("error", "export_failed", {
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
    return NextResponse.json({ error: "Could not generate the Excel file" }, { status: 500 });
  }
  const fileName = `leadlens-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
