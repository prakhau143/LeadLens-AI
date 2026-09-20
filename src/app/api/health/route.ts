import { NextResponse } from "next/server";
import { describeModel } from "@/lib/config/model";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ...describeModel(),
    timestamp: new Date().toISOString(),
  });
}
