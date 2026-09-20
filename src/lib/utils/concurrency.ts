/**
 * Runs `fn` over `items` with at most `limit` concurrent executions,
 * invoking `onSettle` as each item resolves (in completion order, not input
 * order) so callers can stream progress incrementally. A single rejection
 * never stops the rest of the batch — it is reported to `onSettle` like any
 * other outcome.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onSettle?: (result: { index: number; item: T } & (
    | { ok: true; value: R }
    | { ok: false; error: unknown }
  )) => void,
): Promise<Array<{ index: number; item: T } & ({ ok: true; value: R } | { ok: false; error: unknown })>> {
  const results: Array<
    { index: number; item: T } & ({ ok: true; value: R } | { ok: false; error: unknown })
  > = new Array(items.length);

  let cursor = 0;
  const effectiveLimit = Math.max(1, Math.min(limit, items.length || 1));

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      try {
        const value = await fn(item, index);
        const result = { index, item, ok: true as const, value };
        results[index] = result;
        onSettle?.(result);
      } catch (error) {
        const result = { index, item, ok: false as const, error };
        results[index] = result;
        onSettle?.(result);
      }
    }
  }

  await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));
  return results;
}
