"use client";

import { useEffect, useMemo } from "react";
import { Inbox } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { UploadZone } from "@/components/upload/upload-zone";
import { FileList } from "@/components/upload/file-list";
import { Button } from "@/components/ui/button";
import { ProcessingProgress } from "@/components/leads/processing-progress";
import { ResultsSummary } from "@/components/leads/results-summary";
import { ExportButton } from "@/components/leads/export-button";
import { LeadTable } from "@/components/leads/lead-table";
import { EmptyState } from "@/components/leads/empty-state";
import { useExtraction } from "@/hooks/use-extraction";
import { saveBatchToHistory } from "@/lib/utils/history";
import { applyLeadEdit } from "@/lib/services/validation-service";
import { summarize } from "@/lib/services/summary-service";
import type { Lead } from "@/lib/schemas/lead";

export default function LeadsPage() {
  const {
    selected,
    readyFiles,
    addFiles,
    removeFile,
    clearAll,
    startExtraction,
    isProcessing,
    processedCount,
    records,
    setRecords,
    summary: initialSummary,
    error,
    processedFiles,
  } = useExtraction();

  // Counts always reflect the current (possibly hand-corrected) records.
  const summary = useMemo(
    () =>
      records && initialSummary
        ? summarize(records, initialSummary.processedAt)
        : null,
    [records, initialSummary],
  );

  // The batch's processedAt is its stable id, so edits overwrite the same entry.
  useEffect(() => {
    if (!records || !summary) return;
    saveBatchToHistory({
      id: summary.processedAt,
      processedAt: summary.processedAt,
      summary,
      records,
    });
  }, [records, summary]);

  const previewUrls = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    records?.forEach((record, i) => {
      map[record.id] = processedFiles[i]?.previewUrl;
    });
    return map;
  }, [records, processedFiles]);

  function handleUpdateLead(id: string, lead: Lead) {
    setRecords((prev) =>
      prev ? prev.map((r) => (r.id === id ? applyLeadEdit(r, lead) : r)) : prev,
    );
  }

  const showUpload = !isProcessing && !records;

  return (
    <>
      <Navbar />
      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
        {showUpload && (
          <>
            <UploadZone onFilesAdded={addFiles} />
            <FileList files={selected} onRemove={removeFile} />
            {selected.length > 0 && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={clearAll}>
                  Clear All
                </Button>
                <Button
                  type="button"
                  onClick={startExtraction}
                  disabled={readyFiles.length === 0}
                >
                  Extract Leads →
                </Button>
              </div>
            )}
          </>
        )}

        {isProcessing && (
          <ProcessingProgress files={selected} processedCount={processedCount} total={processedFiles.length} />
        )}

        {error && !isProcessing && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {records && summary && (
          <>
            <ResultsSummary
              summary={summary}
              onProcessMore={clearAll}
              exportSlot={<ExportButton leads={records} summary={summary} />}
            />
            {records.length > 0 ? (
              <LeadTable
                records={records}
                previewUrls={previewUrls}
                onUpdateLead={handleUpdateLead}
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="No leads yet"
                description="Upload business cards to begin extracting leads with AI."
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
