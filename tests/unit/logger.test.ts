import { afterEach, describe, expect, it, vi } from "vitest";
import { log, redactSecrets } from "@/lib/utils/logger";

describe("log redaction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("redacts Hugging Face tokens in free text", () => {
    expect(redactSecrets("Authorization: Bearer hf_abcdefghijklmnopqrstuvwxyz0123")).toBe(
      "Authorization: Bearer hf_[redacted]",
    );
  });

  it("never writes a token to the console, even inside an error field", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log("error", "card_failed", { error: "401 for token hf_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345" });
    const written = String(spy.mock.calls[0][0]);
    expect(written).not.toContain("ABCDEFGHIJKLMNOP");
    expect(written).toContain("hf_[redacted]");
  });

  it("leaves ordinary log lines untouched", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "job_started", { total: 3 });
    expect(String(spy.mock.calls[0][0])).toContain('"total":3');
  });
});
