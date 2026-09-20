type Level = "info" | "warn" | "error";

/**
 * Minimal structured logger. Callers must only pass operational metadata
 * (counts, indexes, error codes) — never extracted lead fields or image data.
 */
export function log(
  level: Level,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
