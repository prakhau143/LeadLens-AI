"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, History as HistoryIcon, Trash2, XCircle } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/leads/empty-state";
import { LeadTable } from "@/components/leads/lead-table";
import { ExportButton } from "@/components/leads/export-button";
import {
  clearHistory,
  groupByDay,
  loadHistory,
  saveBatchToHistory,
  type BatchHistoryEntry,
} from "@/lib/utils/history";
import { applyLeadEdit } from "@/lib/services/validation-service";
import { summarize } from "@/lib/services/summary-service";
import type { Lead } from "@/lib/schemas/lead";

export default function HistoryPage() {
  const [entries, setEntries] = useState<BatchHistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Same rationale as the dashboard stats: localStorage is client-only,
    // so this loads after mount rather than via a lazy initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(loadHistory());
  }, []);

  function handleUpdateLead(batchId: string, leadId: string, lead: Lead) {
    const current = entries.find((e) => e.id === batchId);
    if (!current) return;
    const records = current.records.map((r) =>
      r.id === leadId ? applyLeadEdit(r, lead) : r,
    );
    const updated: BatchHistoryEntry = {
      ...current,
      records,
      summary: summarize(records, current.summary.processedAt),
    };
    saveBatchToHistory(updated);
    setEntries((prev) => prev.map((e) => (e.id === batchId ? updated : e)));
  }

  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="focus:outline-none flex w-full flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">History</h1>
            <p className="text-sm text-muted-foreground">Recent extractions, newest first.</p>
          </div>
          {entries.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearHistory();
                setEntries([]);
              }}
            >
              <Trash2 className="size-3.5" /> Clear history
            </Button>
          )}
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No extraction history yet."
            description="Batches you process on the Leads page will appear here, newest first. History is stored on this device only."
            action={
              <Button render={<Link href="/leads" />} nativeButton={false} className="h-11 px-5 sm:h-10">
                Upload Cards
              </Button>
            }
          >
            <div className="mt-2 max-w-sm border-t border-border/60 pt-4 text-sm">
              <p className="font-medium">Want to see how it works?</p>
              <Link href="/leads#samples" className="text-brand underline-offset-4 hover:underline">
                Try a sample card
              </Link>
            </div>
          </EmptyState>
        ) : (
          <div className="space-y-8">
            {groupByDay(entries).map((group) => (
              <section key={group.label} className="space-y-3" aria-labelledby={`hist-${group.label}`}>
                <h2
                  id={`hist-${group.label}`}
                  className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
                >
                  {group.label}
                </h2>
                <ul className="space-y-3 border-l border-border/70 pl-4">
                  {group.entries.map((entry) => {
                    const isOpen = expandedId === entry.id;
                    const successful = entry.summary.extracted;
                    return (
                      <li key={entry.id} className="glass-card ll-lift rounded-xl">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                          <button
                            type="button"
                            className="min-w-0 flex-1 rounded-lg text-left"
                            aria-expanded={isOpen}
                            aria-controls={`hist-body-${entry.id}`}
                            onClick={() => setExpandedId(isOpen ? null : entry.id)}
                          >
                            <p className="font-medium">
                              {new Date(entry.processedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                              {group.label === "Earlier" && (
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                  {new Date(entry.processedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                                </span>
                              )}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span>{entry.summary.total} {entry.summary.total === 1 ? "card" : "cards"}</span>
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                                {successful} successful
                              </span>
                              {entry.summary.needsReview > 0 && (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="size-3.5 text-warning" aria-hidden />
                                  {entry.summary.needsReview} need review
                                </span>
                              )}
                              {entry.summary.failed > 0 && (
                                <span className="flex items-center gap-1">
                                  <XCircle className="size-3.5 text-destructive" aria-hidden />
                                  {entry.summary.failed} failed
                                </span>
                              )}
                            </p>
                          </button>
                          <div className="flex gap-2">
                            <ExportButton leads={entry.records} summary={entry.summary} />
                            <Button type="button" variant="outline" onClick={() => setExpandedId(isOpen ? null : entry.id)}>
                              {isOpen ? "Hide" : "View results"}
                            </Button>
                          </div>
                        </div>

                        {isOpen && (
                          <div id={`hist-body-${entry.id}`} className="border-t border-border/60 p-4">
                            <LeadTable
                              records={entry.records}
                              previewUrls={{}}
                              onUpdateLead={(leadId, lead) => handleUpdateLead(entry.id, leadId, lead)}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
