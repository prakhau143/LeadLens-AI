import { describe, expect, it } from "vitest";
import { aggregateStats, dayLabel, groupByDay, type BatchHistoryEntry } from "@/lib/utils/history";

const NOW = new Date(2026, 8, 20, 15, 0, 0); // 20 Sep 2026, local

function entry(id: string, at: Date, s: Partial<BatchHistoryEntry["summary"]> = {}): BatchHistoryEntry {
  return {
    id, processedAt: at.toISOString(), records: [],
    summary: { total: 0, extracted: 0, needsReview: 0, failed: 0, duplicates: 0, processedAt: at.toISOString(), ...s },
  };
}

describe("history helpers", () => {
  it("labels today, yesterday and older dates", () => {
    expect(dayLabel(new Date(2026, 8, 20, 9, 0).toISOString(), NOW)).toBe("Today");
    expect(dayLabel(new Date(2026, 8, 19, 23, 0).toISOString(), NOW)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 8, 1, 9, 0).toISOString(), NOW)).toBe("Earlier");
    expect(dayLabel(new Date(2026, 8, 18, 9, 0).toISOString(), NOW)).toBe("Earlier"); // 2 days ago
  });

  it("groups newest-first entries into consecutive day buckets", () => {
    const groups = groupByDay(
      [
        entry("a", new Date(2026, 8, 20, 10, 0)),
        entry("b", new Date(2026, 8, 20, 9, 0)),
        entry("c", new Date(2026, 8, 19, 16, 0)),
        entry("d", new Date(2026, 7, 2, 16, 0)),
        entry("e", new Date(2026, 6, 1, 16, 0)),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      ["Earlier", ["d", "e"]],
    ]);
  });

  it("aggregates totals including needs-review and failed", () => {
    const stats = aggregateStats([
      entry("a", NOW, { total: 10, extracted: 7, needsReview: 2, failed: 1 }),
      entry("b", NOW, { total: 5, extracted: 5 }),
    ]);
    expect(stats).toMatchObject({ cards: 15, leads: 14, needsReview: 2, failed: 1 });
    expect(stats.successRate).toBe(93.3);
  });
});
