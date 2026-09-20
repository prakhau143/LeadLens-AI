import type { Lead, LeadRecord, LeadStatus } from "@/lib/schemas/lead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same plausibility check the status logic uses; shared with the edit form. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function cleanString(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string | null): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  // Collapse internal whitespace runs, keep digits/+/()/- as printed.
  return cleaned.replace(/\s+/g, " ");
}

function normalizeEmail(value: string | null): string | null {
  const cleaned = cleanString(value);
  return cleaned;
}

export function normalizeLead(raw: Lead): Lead {
  return {
    first_name: cleanString(raw.first_name),
    last_name: cleanString(raw.last_name),
    job_title: cleanString(raw.job_title),
    company: cleanString(raw.company),
    location: cleanString(raw.location),
    phone: normalizePhone(raw.phone),
    email: normalizeEmail(raw.email),
  };
}

/**
 * A lead needs review when any field is missing, or when a present
 * email/phone doesn't look well-formed — never because we guessed wrong,
 * since we never invent values.
 */
export function deriveStatus(lead: Lead): Exclude<LeadStatus, "failed" | "duplicate"> {
  const fields: (string | null)[] = [
    lead.first_name,
    lead.last_name,
    lead.job_title,
    lead.company,
    lead.location,
    lead.phone,
    lead.email,
  ];

  const hasMissingField = fields.some((f) => f == null);
  const hasMalformedEmail = lead.email != null && !EMAIL_RE.test(lead.email);

  return hasMissingField || hasMalformedEmail ? "needs_review" : "extracted";
}

/**
 * Applies a manual edit: re-normalizes the lead and recomputes its status, so
 * fixing every missing field clears "needs review". A record with no values at
 * all keeps its original status (e.g. "failed").
 */
export function applyLeadEdit(record: LeadRecord, edited: Lead): LeadRecord {
  const lead = normalizeLead(edited);
  const hasAnyValue = Object.values(lead).some((v) => v != null);
  return {
    ...record,
    lead,
    status: hasAnyValue ? deriveStatus(lead) : record.status,
    failureReason: hasAnyValue ? null : record.failureReason,
  };
}
