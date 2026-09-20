"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/navbar";
import { UploadZone } from "@/components/upload/upload-zone";
import { FileList } from "@/components/upload/file-list";
import { SampleCards } from "@/components/upload/sample-cards";
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
    retryCard,
    retryingIds,
    importExcel,
    isImporting,
    extractNow,
  } = useExtraction();

  /** Images go to extraction; an .xlsx is imported on its own (one at a time). */
  function handleFilesAdded(files: File[]) {
    const isXlsx = (f: File) => /\.xlsx$/i.test(f.name);
    const sheets = files.filter(isXlsx);
    if (sheets.length === 0) {
      addFiles(files);
      return;
    }
    if (sheets.length > 1 || sheets.length < files.length) {
      toast.info("Excel files are imported one at a time, separately from images. Importing the first Excel file only.");
    }
    void importExcel(sheets[0]);
  }

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
      <main
        id="main-content"
        tabIndex={-1}
        className="flex w-full flex-1 flex-col gap-5 px-4 py-6 focus:outline-none sm:px-6 sm:py-8 lg:px-8 xl:px-12"
      >
        <header>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Lead workspace</h1>
          <p className="text-sm text-muted-foreground">
            Upload cards, let Qwen3-VL read them, then review, edit and export.
          </p>
        </header>

        {showUpload && (
          <>
            <UploadZone
              onFilesAdded={handleFilesAdded}
              onFilesRejected={(names) =>
                toast.error(
                  `Can't use ${names.length === 1 ? names[0] : `${names.length} files`}. Upload JPG, PNG or WEBP card images, or an .xlsx exported from LeadLens.`,
                )
              }
              disabled={isImporting}
            />

            {selected.length > 0 && (
              <div className="space-y-4">
                <FileList files={selected} onRemove={removeFile} onClear={clearAll} />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="lg"
                    className="h-11 w-full px-6 text-base sm:h-10 sm:w-auto sm:text-sm"
                    onClick={startExtraction}
                    disabled={readyFiles.length === 0}
                  >
                    Extract {readyFiles.length} {readyFiles.length === 1 ? "card" : "cards"} →
                  </Button>
                </div>
              </div>
            )}

            <SampleCards onRun={(file) => void extractNow([file])} disabled={isImporting} />
          </>
        )}

        {isProcessing && (
          <ProcessingProgress files={selected} processedCount={processedCount} total={processedFiles.length} />
        )}

        {error && !isProcessing && (
          <div role="alert" className="glass-card flex items-start gap-3 rounded-xl border-destructive/40 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="font-medium">Extraction could not finish</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
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
                onRetry={retryCard}
                retryingIds={retryingIds}
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="Your lead workspace is empty."
                description="Upload business cards to start building your lead database."
                action={<Button onClick={clearAll}>Upload Cards</Button>}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
