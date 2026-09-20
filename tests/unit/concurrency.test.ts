import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

describe("mapWithConcurrency", () => {
  it("resolves every item in input order regardless of completion timing", async () => {
    const results = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (n) => {
        await new Promise((r) => setTimeout(r, (5 - n) * 2));
        return n * 2;
      },
    );

    expect(results.map((r) => (r.ok ? r.value : null))).toEqual([2, 4, 6, 8, 10]);
  });

  it("does not let one rejection stop the rest of the batch", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error("card 2 failed");
      return n;
    });

    expect(results[0]).toMatchObject({ ok: true, value: 1 });
    expect(results[1].ok).toBe(false);
    expect(results[2]).toMatchObject({ ok: true, value: 3 });
  });

  it("never runs more than `limit` tasks concurrently", async () => {
    let active = 0;
    let maxActive = 0;

    await mapWithConcurrency(Array.from({ length: 10 }), 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
