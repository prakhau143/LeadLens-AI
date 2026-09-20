import { createHash } from "node:crypto";

/** Deterministic content hash used for in-batch duplicate-image detection. */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
