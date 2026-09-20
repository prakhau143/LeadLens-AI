type Level = "info" | "warn" | "error";

/**
 * Minimal structured logger. Callers must only pass operational metadata
 * (counts, indexes, error codes) — never extracted lead fields or image data.
 */
/** Hugging Face tokens look like `hf_` + 30+ alphanumerics; never let one reach a log line. */
export function redactSecrets(text: string): string {
  return text.replace(/hf_[A-Za-z0-9]{10,}/g, "hf_[redacted]");
}

export function log(
  level: Level,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = redactSecrets(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      ...fields,
    }),
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
