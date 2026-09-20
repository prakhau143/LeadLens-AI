import { describe, expect, it } from "vitest";
import { leadCompleteness } from "@/lib/utils/completeness";
import type { Lead } from "@/lib/schemas/lead";

const EMPTY: Lead = {
  first_name: null, last_name: null, job_title: null, company: null,
  location: null, phone: null, email: null,
};

describe("leadCompleteness", () => {
  it("counts only non-empty fields", () => {
    expect(leadCompleteness(EMPTY)).toEqual({ filled: 0, total: 7 });
    expect(leadCompleteness({ ...EMPTY, first_name: "A", email: "a@b.co" })).toEqual({ filled: 2, total: 7 });
  });
  it("treats whitespace-only values as missing", () => {
    expect(leadCompleteness({ ...EMPTY, company: "   " }).filled).toBe(0);
  });
  it("reports 7/7 for a full lead", () => {
    const full: Lead = {
      first_name: "x", last_name: "x", job_title: "x", company: "x",
      location: "x", phone: "x", email: "x",
    };
    expect(leadCompleteness(full)).toEqual({ filled: 7, total: 7 });
  });
});
