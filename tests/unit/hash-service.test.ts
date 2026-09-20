import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/services/hash-service";

describe("sha256Hex", () => {
  it("is deterministic for identical bytes", () => {
    const a = sha256Hex(Buffer.from("hello world"));
    const b = sha256Hex(Buffer.from("hello world"));
    expect(a).toBe(b);
  });

  it("differs for different bytes", () => {
    const a = sha256Hex(Buffer.from("card one"));
    const b = sha256Hex(Buffer.from("card two"));
    expect(a).not.toBe(b);
  });
});
