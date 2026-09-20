import { describe, expect, it } from "vitest";
import { deriveStatus, isValidEmail, normalizeLead } from "@/lib/services/validation-service";
import type { Lead } from "@/lib/schemas/lead";

const fullLead: Lead = {
  first_name: "Rahul",
  last_name: "Sharma",
  job_title: "CEO",
  company: "ABC Technologies",
  location: "New Delhi",
  phone: "+91 9876543210",
  email: "rahul@abc.com",
};

describe("normalizeLead", () => {
  it("trims whitespace but never invents values", () => {
    const normalized = normalizeLead({
      ...fullLead,
      first_name: "  Rahul  ",
      company: "   ",
    });
    expect(normalized.first_name).toBe("Rahul");
    expect(normalized.company).toBeNull();
  });

  it("passes through nulls untouched", () => {
    const normalized = normalizeLead({ ...fullLead, phone: null });
    expect(normalized.phone).toBeNull();
  });
});

describe("deriveStatus", () => {
  it("marks a fully-populated, well-formed lead as extracted", () => {
    expect(deriveStatus(fullLead)).toBe("extracted");
  });

  it("marks a lead with any missing field as needs_review", () => {
    expect(deriveStatus({ ...fullLead, location: null })).toBe("needs_review");
  });

  it("marks a malformed email as needs_review even if nothing is missing", () => {
    expect(deriveStatus({ ...fullLead, email: "not-an-email" })).toBe(
      "needs_review",
    );
  });
});

import { applyLeadEdit } from "@/lib/services/validation-service";
import { summarize } from "@/lib/services/summary-service";
import type { LeadRecord } from "@/lib/schemas/lead";

describe("applyLeadEdit", () => {
  const needsReview: LeadRecord = {
    id: "1", sourceFileName: "a.jpg", status: "needs_review", failureReason: null,
    lead: { ...fullLead, phone: null },
  };

  it("clears needs_review once every missing field is filled in", () => {
    const fixed = applyLeadEdit(needsReview, { ...fullLead, phone: "  +1 555 0100 " });
    expect(fixed.status).toBe("extracted");
    expect(fixed.lead.phone).toBe("+1 555 0100");
  });

  it("stays needs_review while a field is still missing", () => {
    expect(applyLeadEdit(needsReview, { ...fullLead, phone: null, location: null }).status).toBe("needs_review");
  });

  it("turns a failed (empty) record into a lead once the user fills something in", () => {
    const failed: LeadRecord = { ...needsReview, status: "failed", failureReason: "x", lead: { first_name: null, last_name: null, job_title: null, company: null, location: null, phone: null, email: null } };
    const fixed = applyLeadEdit(failed, { ...failed.lead, first_name: "Sam" });
    expect(fixed.status).toBe("needs_review");
    expect(fixed.failureReason).toBeNull();
  });

  it("keeps a failed record failed if it is still empty", () => {
    const failed: LeadRecord = { ...needsReview, status: "failed", failureReason: "x", lead: { first_name: null, last_name: null, job_title: null, company: null, location: null, phone: null, email: null } };
    expect(applyLeadEdit(failed, failed.lead).status).toBe("failed");
  });
});

describe("summarize", () => {
  it("counts each status and keeps the original timestamp", () => {
    const mk = (status: LeadRecord["status"]): LeadRecord => ({ id: status, sourceFileName: "x", status, failureReason: null, lead: fullLead });
    const s = summarize([mk("extracted"), mk("extracted"), mk("needs_review"), mk("failed"), mk("duplicate")], "T");
    expect(s).toEqual({ total: 5, extracted: 2, needsReview: 1, failed: 1, duplicates: 1, processedAt: "T" });
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses and trims whitespace", () => {
    expect(isValidEmail("hello@reallygreatsite.com")).toBe(true);
    expect(isValidEmail("  a.b+c@sub.example.co  ")).toBe(true);
  });
  it("rejects text that is not an address", () => {
    for (const bad of ["bad address", "no-at-sign.com", "a@b", "a@ b.com", "@x.com", ""]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});
