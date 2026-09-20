import { z } from "zod";
import { BatchSummarySchema, LeadRecordSchema } from "./lead";

/**
 * Real per-card pipeline stages, emitted when the server actually enters them:
 * preparing = validate + normalize image, reading = the Qwen model call,
 * validating = JSON check + normalization.
 */
export const CARD_STAGES = ["preparing", "reading", "validating"] as const;
export type CardStage = (typeof CARD_STAGES)[number];

/** Server-Sent Event payloads streamed from POST /api/extract. */
export type ExtractionEvent =
  | { type: "card_started"; index: number; fileName: string; total: number }
  | { type: "card_stage"; index: number; stage: CardStage }
  | {
      type: "card_completed";
      index: number;
      fileName: string;
      record: z.infer<typeof LeadRecordSchema>;
    }
  | {
      type: "card_duplicate";
      index: number;
      fileName: string;
      record: z.infer<typeof LeadRecordSchema>;
    }
  | {
      type: "card_failed";
      index: number;
      fileName: string;
      reason: string;
    }
  | {
      type: "done";
      summary: z.infer<typeof BatchSummarySchema>;
      records: z.infer<typeof LeadRecordSchema>[];
    }
  | { type: "error"; message: string };

export const ExportRequestSchema = z.object({
  leads: z.array(LeadRecordSchema).max(1000),
  summary: BatchSummarySchema,
});

export type ExportRequest = z.infer<typeof ExportRequestSchema>;
