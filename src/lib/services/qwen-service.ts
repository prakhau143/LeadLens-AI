import { generateObject, NoObjectGeneratedError, type LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Client } from "@gradio/client";
import { getModelConfig } from "@/lib/config/model";
import { extractJsonObject } from "@/lib/utils/json-parser";
import { LeadSchema, type Lead } from "@/lib/schemas/lead";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
  EXTRACTION_JSON_TEMPLATE,
} from "@/lib/prompts/extraction-prompt";

function resolveModel(): LanguageModel {
  const config = getModelConfig();
  if (config.provider === "hf-space") {
    throw new Error("hf-space provider does not use an AI SDK model");
  }
  if (config.provider === "self-hosted") {
    return createOpenAICompatible({
      name: "qwen-self-hosted",
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      supportsStructuredOutputs: true,
    }).chatModel(config.model);
  }
  // Plain "provider/model" string routes through Vercel AI Gateway.
  return config.model;
}

/** Filled in by the provider so callers can log where the time went. */
export interface ExtractionTimings {
  /** Wall-clock time of the whole model call, including queue/cold start. */
  modelRequestMs?: number;
  /** GPU execution time reported by the Space (what ZeroGPU quota is charged on). */
  modelInferenceMs?: number;
  parsingMs?: number;
}

export type ExtractionErrorCode =
  | "provider_unavailable" // auth / billing / permission: retrying cannot help
  | "quota_exceeded" // free GPU quota used up: retrying cannot help until it resets
  | "provider_unreachable" // network failure reaching the model server (retried once)
  | "rate_limited"
  | "model_output" // model replied but not with valid structured output
  | "unknown";

export class ExtractionError extends Error {
  constructor(
    readonly code: ExtractionErrorCode,
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

function classify(error: unknown): ExtractionError {
  if (error instanceof ExtractionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const statusCode =
    typeof (error as { statusCode?: unknown })?.statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : undefined;

  const name = error instanceof Error ? error.name : "";
  const causeCode = (error as { cause?: { code?: unknown } })?.cause?.code;

  // ZeroGPU daily quota exhausted: retrying just burns another call
  if (/exceeded your .*quota/i.test(message)) {
    return new ExtractionError("quota_exceeded", message, statusCode);
  }
  if (
    statusCode === 401 ||
    statusCode === 402 ||
    statusCode === 403 ||
    /authentication|unauthenticated/i.test(`${name} ${message}`)
  ) {
    return new ExtractionError("provider_unavailable", message, statusCode);
  }
  if (
    (typeof causeCode === "string" &&
      ["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(causeCode)) ||
    /cannot connect|fetch failed/i.test(message)
  ) {
    return new ExtractionError("provider_unreachable", message, statusCode);
  }
  if (statusCode === 429) {
    return new ExtractionError("rate_limited", message, statusCode);
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    return new ExtractionError("model_output", message, statusCode);
  }
  return new ExtractionError("unknown", message, statusCode);
}

// One connection per server instance: connecting fetches the Space's API schema.
let hfClient: { spaceId: string; client: Promise<Client> } | null = null;

function getHfClient(spaceId: string, token?: string): Promise<Client> {
  if (hfClient?.spaceId !== spaceId) {
    const client = Client.connect(spaceId, {
      token: token as `hf_${string}` | undefined,
    }).catch((error) => {
      hfClient = null; // don't cache a failed (e.g. sleeping-Space) connection
      throw error;
    });
    hfClient = { spaceId, client };
  }
  return hfClient.client;
}

/**
 * The Space returns the model's raw text; parsing and schema validation stay
 * here so every provider goes through the same checks.
 */
async function runHfSpaceExtraction(
  imageBuffer: Buffer,
  spaceId: string,
  token?: string,
  timings?: ExtractionTimings,
): Promise<Lead> {
  const requestStart = performance.now();
  const client = await getHfClient(spaceId, token);
  const result = await client.predict("/extract", {
    image: new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" }),
    system_prompt: EXTRACTION_SYSTEM_PROMPT,
    user_prompt: `${EXTRACTION_USER_PROMPT}\n\n${EXTRACTION_JSON_TEMPLATE}`,
  });
  const requestEnd = performance.now();
  const [rawText, rawTiming] = (result.data as unknown[]) ?? [];
  const text = String(rawText ?? "");
  const parseStart = performance.now();
  const json = extractJsonObject(text);
  if (!json) {
    throw new ExtractionError("model_output", "Model reply contained no complete JSON object");
  }
  const parsed = LeadSchema.safeParse(JSON.parse(json));
  if (!parsed.success) {
    throw new ExtractionError("model_output", "Model JSON did not match the lead schema");
  }
  if (timings) {
    timings.modelRequestMs = Math.round(requestEnd - requestStart);
    timings.parsingMs = Math.round(performance.now() - parseStart);
    try {
      const ms = (JSON.parse(String(rawTiming)) as { inference_ms?: unknown }).inference_ms;
      if (typeof ms === "number") timings.modelInferenceMs = ms;
    } catch {
      // older Space revision without timing output
    }
  }
  return parsed.data;
}

async function runExtraction(imageBuffer: Buffer, timings?: ExtractionTimings): Promise<Lead> {
  const config = getModelConfig();
  if (config.provider === "hf-space") {
    return runHfSpaceExtraction(imageBuffer, config.spaceId, config.token, timings);
  }
  const requestStart = performance.now();
  const { object } = await generateObject({
    model: resolveModel(),
    schema: LeadSchema,
    // Models sometimes wrap JSON in ```fences``` or prose despite instructions.
    repairText: async ({ text }) => extractJsonObject(text),
    instructions: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_USER_PROMPT },
          { type: "file", mediaType: "image/jpeg", data: imageBuffer },
        ],
      },
    ],
  });
  if (timings) timings.modelRequestMs = Math.round(performance.now() - requestStart);
  return object;
}

/**
 * Runs the Qwen VLM extraction. Retries once for transient / malformed-output
 * failures, but never for auth/billing errors — those are permanent and a
 * retry only doubles the failed calls. Always throws a classified
 * ExtractionError so callers can log the cause and show an honest message.
 */
export async function extractLead(
  imageBuffer: Buffer,
  timings?: ExtractionTimings,
): Promise<Lead> {
  try {
    return await runExtraction(imageBuffer, timings);
  } catch (first) {
    const classified = classify(first);
    if (classified.code === "provider_unavailable" || classified.code === "quota_exceeded") {
      throw classified;
    }

    try {
      return await runExtraction(imageBuffer, timings);
    } catch (second) {
      throw classify(second);
    }
  }
}
