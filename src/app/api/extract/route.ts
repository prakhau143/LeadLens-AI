import { nanoid } from "nanoid";
import {
  getMaxImageSizeBytes,
  getMaxUploadImages,
  preprocessImage,
  validateImage,
} from "@/lib/services/image-service";
import { sha256Hex } from "@/lib/services/hash-service";
import { ExtractionError, extractLead, type ExtractionTimings } from "@/lib/services/qwen-service";
import { describeModel } from "@/lib/config/model";
import { log } from "@/lib/utils/logger";
import { deriveStatus, normalizeLead } from "@/lib/services/validation-service";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import type { LeadRecord } from "@/lib/schemas/lead";
import { summarize } from "@/lib/services/summary-service";
import type { ExtractionEvent } from "@/lib/schemas/extraction";

export const runtime = "nodejs";
export const maxDuration = 300;

const CONCURRENCY = 3;

const FAILURE_MESSAGES = {
  provider_unavailable:
    "The AI service is currently unavailable (configuration or billing issue). Please contact the administrator.",
  quota_exceeded:
    "The free GPU quota for the AI model is used up for now. It resets daily; please try again later.",
  provider_unreachable:
    "The AI service could not be reached. Please try again shortly or contact the administrator.",
  rate_limited: "The AI service is busy. Please try again in a moment.",
  model_output: "The model returned an unreadable response for this card.",
  unknown: "Unable to process this card. Please try again.",
} as const;

function sseLine(event: ExtractionEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function processCard(
  file: File,
  index: number,
  total: number,
  seenHashes: Set<string>,
  emit: (event: ExtractionEvent) => void,
): Promise<LeadRecord> {
  const fileName = file.name || `card-${index + 1}`;
  emit({ type: "card_started", index, fileName, total });
  emit({ type: "card_stage", index, stage: "preparing" });

  const makeRecord = (
    status: LeadRecord["status"],
    overrides: Partial<LeadRecord> = {},
  ): LeadRecord => ({
    id: nanoid(),
    sourceFileName: fileName,
    status,
    lead: {
      first_name: null,
      last_name: null,
      job_title: null,
      company: null,
      location: null,
      phone: null,
      email: null,
    },
    failureReason: null,
    ...overrides,
  });

  const startedAt = performance.now();
  try {
    if (file.size > getMaxImageSizeBytes()) {
      log("warn", "validation_failed", { index, reason: "file too large" });
      const reason = `File exceeds ${Math.round(getMaxImageSizeBytes() / (1024 * 1024))}MB limit`;
      emit({ type: "card_failed", index, fileName, reason });
      return makeRecord("failed", { failureReason: reason });
    }
    const rawBuffer = Buffer.from(await file.arrayBuffer());

    const validation = await validateImage(rawBuffer);
    if (!validation.valid) {
      log("warn", "validation_failed", { index, reason: validation.reason });
      const record = makeRecord("failed", {
        failureReason: validation.reason ?? "Invalid image",
      });
      emit({ type: "card_failed", index, fileName, reason: record.failureReason! });
      return record;
    }

    const prepStart = performance.now();
    const processedBuffer = await preprocessImage(rawBuffer);
    const imagePreparationMs = Math.round(performance.now() - prepStart);
    const hash = sha256Hex(processedBuffer);

    if (seenHashes.has(hash)) {
      const record = makeRecord("duplicate");
      emit({ type: "card_duplicate", index, fileName, record });
      return record;
    }
    seenHashes.add(hash);

    const timings: ExtractionTimings = {};
    emit({ type: "card_stage", index, stage: "reading" });
    const rawLead = await extractLead(processedBuffer, timings);
    emit({ type: "card_stage", index, stage: "validating" });
    const lead = normalizeLead(rawLead);
    const status = deriveStatus(lead);
    const totalMs = Math.round(performance.now() - startedAt);
    log("info", "card_timing", {
      index,
      image_preparation_ms: imagePreparationMs,
      model_request_ms: timings.modelRequestMs,
      model_inference_ms: timings.modelInferenceMs,
      parsing_ms: timings.parsingMs,
      total_ms: totalMs,
    });
    const record = makeRecord(status, {
      lead,
      timings: {
        imagePreparationMs,
        modelRequestMs: timings.modelRequestMs,
        modelInferenceMs: timings.modelInferenceMs,
        parsingMs: timings.parsingMs,
        totalMs,
      },
    });
    emit({ type: "card_completed", index, fileName, record });
    return record;
  } catch (error) {
    const code = error instanceof ExtractionError ? error.code : "unknown";
    log("error", "card_failed", {
      index,
      code,
      statusCode: error instanceof ExtractionError ? error.statusCode : undefined,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
    const record = makeRecord("failed", {
      failureReason: FAILURE_MESSAGES[code],
    });
    emit({
      type: "card_failed",
      index,
      fileName,
      reason: record.failureReason!,
    });
    return record;
  }
}

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  // Reject an oversized body before buffering it. Content-Length can be
  // absent (chunked uploads); per-file limits below still apply in that case.
  const declared = Number(request.headers.get("content-length"));
  const maxBody =
    getMaxUploadImages() * getMaxImageSizeBytes() + MULTIPART_OVERHEAD_BYTES;
  if (Number.isFinite(declared) && declared > maxBody) {
    return jsonError("Upload is too large", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return new Response(
      JSON.stringify({ error: "No images were uploaded" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const maxImages = getMaxUploadImages();
  if (files.length > maxImages) {
    return new Response(
      JSON.stringify({
        error: `Batch exceeds the maximum of ${maxImages} images`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  log("info", "job_started", { total: files.length, ...describeModel() });
  const encoder = new TextEncoder();
  const seenHashes = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ExtractionEvent) => {
        controller.enqueue(encoder.encode(sseLine(event)));
      };

      try {
        const settled = await mapWithConcurrency(
          files,
          CONCURRENCY,
          (file, index) => processCard(file, index, files.length, seenHashes, emit),
        );

        const records = settled.map((r) =>
          r.ok
            ? r.value
            : ({
                id: nanoid(),
                sourceFileName: r.item.name,
                status: "failed",
                lead: {
                  first_name: null,
                  last_name: null,
                  job_title: null,
                  company: null,
                  location: null,
                  phone: null,
                  email: null,
                },
                failureReason: "Unexpected processing error",
              } satisfies LeadRecord),
        );

        const summary = summarize(records);

        log("info", "job_completed", { ...summary });
        emit({ type: "done", summary, records });
      } catch (error) {
        log("error", "job_failed", {
          error: error instanceof Error ? error.message.slice(0, 300) : String(error),
        });
        emit({ type: "error", message: "Batch processing failed. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
