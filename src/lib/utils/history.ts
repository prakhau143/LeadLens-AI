import type { BatchSummary, LeadRecord } from "@/lib/schemas/lead";

export interface BatchHistoryEntry {
  id: string;
  processedAt: string;
  summary: BatchSummary;
  records: LeadRecord[];
}

const STORAGE_KEY = "leadlens.history.v1";
const MAX_ENTRIES = 20;

/**
 * There is no database in this app (see README "Known Limitations") — batch
 * history lives in the browser's localStorage only, per-device, capped to
 * the most recent 20 batches.
 */
export function loadHistory(): BatchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Inserts a batch, or replaces the stored one with the same id (after edits). */
export function saveBatchToHistory(entry: BatchHistoryEntry): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadHistory();
    const index = existing.findIndex((e) => e.id === entry.id);
    const next =
      index === -1
        ? [entry, ...existing].slice(0, MAX_ENTRIES)
        : existing.map((e, i) => (i === index ? entry : e));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage can throw (private browsing, quota) — history is a
    // convenience feature, never block the core extraction flow on it.
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function aggregateStats(entries: BatchHistoryEntry[]) {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.cards += entry.summary.total;
      acc.leads += entry.summary.extracted + entry.summary.needsReview;
      acc.needsReview += entry.summary.needsReview;
      acc.failed += entry.summary.failed;
      return acc;
    },
    { cards: 0, leads: 0, needsReview: 0, failed: 0 },
  );
  const successRate =
    totals.cards === 0 ? 0 : Math.round((totals.leads / totals.cards) * 1000) / 10;
  return { ...totals, successRate };
}

/** "Today" / "Yesterday" / a short date, judged in the viewer's local time. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const day = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(day)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return day.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Groups entries (already newest-first) into consecutive day buckets. */
export function groupByDay(
  entries: BatchHistoryEntry[],
  now: Date = new Date(),
): { label: string; entries: BatchHistoryEntry[] }[] {
  const groups: { label: string; entries: BatchHistoryEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.processedAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}
