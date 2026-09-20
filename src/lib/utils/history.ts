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
      return acc;
    },
    { cards: 0, leads: 0 },
  );
  const successRate =
    totals.cards === 0 ? 0 : Math.round((totals.leads / totals.cards) * 1000) / 10;
  return { ...totals, successRate };
}
