"use client";

import { useEffect, useState } from "react";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/leads/empty-state";
import { LeadTable } from "@/components/leads/lead-table";
import { ExportButton } from "@/components/leads/export-button";
import {
  clearHistory,
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
      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-xl font-semibold">History</h1>
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
            title="No batches yet"
            description="Batches you process on the Leads page will show up here. History is stored on this device only."
          />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isOpen = expandedId === entry.id;
              return (
                <div key={entry.id} className="glass-card rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {new Date(entry.processedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.summary.total} cards · {entry.summary.extracted} extracted ·{" "}
                        {entry.summary.needsReview} needs review · {entry.summary.failed} failed
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <ExportButton leads={entry.records} summary={entry.summary} />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setExpandedId(isOpen ? null : entry.id)}
                      >
                        {isOpen ? "Hide" : "View"}
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4">
                      <LeadTable
                        records={entry.records}
                        previewUrls={{}}
                        onUpdateLead={(leadId, lead) =>
                          handleUpdateLead(entry.id, leadId, lead)
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
