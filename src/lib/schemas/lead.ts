import { z } from "zod";

/**
 * Fields the Qwen VLM is asked to extract. Every field is nullable because a
 * business card frequently omits one or more of them — the model must never
 * invent a value it can't see.
 */
export const LeadSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  job_title: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});

export type Lead = z.infer<typeof LeadSchema>;

export const LEAD_STATUSES = [
  "extracted",
  "needs_review",
  "failed",
  "duplicate",
] as const;

export const LeadStatusSchema = z.enum(LEAD_STATUSES);

export type LeadStatus = z.infer<typeof LeadStatusSchema>;

/** Measured server-side per card; every field is optional (providers differ). */
export const ProcessingTimingsSchema = z.object({
  imagePreparationMs: z.number().optional(),
  modelRequestMs: z.number().optional(),
  modelInferenceMs: z.number().optional(),
  parsingMs: z.number().optional(),
  totalMs: z.number().optional(),
});

export type ProcessingTimings = z.infer<typeof ProcessingTimingsSchema>;

export const LeadRecordSchema = z.object({
  id: z.string(),
  sourceFileName: z.string(),
  status: LeadStatusSchema,
  lead: LeadSchema,
  failureReason: z.string().nullable().default(null),
  timings: ProcessingTimingsSchema.optional(),
});

export type LeadRecord = z.infer<typeof LeadRecordSchema>;

export const BatchSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  extracted: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  processedAt: z.string(),
});

export type BatchSummary = z.infer<typeof BatchSummarySchema>;

export const LEAD_TABLE_COLUMNS: { key: keyof Lead; label: string }[] = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "job_title", label: "Position / Job Title" },
  { key: "company", label: "Company" },
  { key: "location", label: "Location" },
  { key: "phone", label: "Phone Number" },
  { key: "email", label: "Email Address" },
];
