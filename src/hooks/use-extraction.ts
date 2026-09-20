"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import type { BatchSummary, LeadRecord } from "@/lib/schemas/lead";
import type { CardStage, ExtractionEvent } from "@/lib/schemas/extraction";

export type CardStatus =
  | "waiting"
  | "processing"
  | "extracted"
  | "needs_review"
  | "failed"
  | "duplicate";

export interface SelectedFile {
  id: string;
  file: File;
  previewUrl: string;
  status: CardStatus;
  /** Real pipeline stage reported by the server while status is "processing". */
  stage?: CardStage;
  reason?: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_CLIENT_SIZE_MB = 8;
export const MAX_IMAGES_PER_BATCH = 50;
const MAX_IMPORT_MB = 5;

function validateClientSide(file: File): { ok: boolean; reason?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, reason: "Unsupported file type" };
  }
  if (file.size > MAX_CLIENT_SIZE_MB * 1024 * 1024) {
    return { ok: false, reason: `Exceeds ${MAX_CLIENT_SIZE_MB}MB limit` };
  }
  return { ok: true };
}

/** Reads a text/event-stream response, calling onEvent for each JSON `data:` line. */
async function readEvents(
  response: Response,
  onEvent: (event: ExtractionEvent) => void,
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const jsonText = line.slice(5).trim();
      if (!jsonText) continue;
      try {
        onEvent(JSON.parse(jsonText) as ExtractionEvent);
      } catch {
        // ignore a malformed line
      }
    }
  }
}

export function useExtraction() {
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [records, setRecords] = useState<LeadRecord[] | null>(null);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processedFiles, setProcessedFiles] = useState<SelectedFile[]>([]);

  // Mirrors selected.length so addFiles can enforce the cap synchronously.
  // Kept in sync from an effect, never mutated inside a state updater.
  const selectedCount = useRef(0);
  useEffect(() => {
    selectedCount.current = selected.length;
  }, [selected]);

  const addFiles = useCallback((incoming: File[]) => {
    const capacity = MAX_IMAGES_PER_BATCH - selectedCount.current;
    if (capacity <= 0) {
      toast.error(`Batch limit reached (${MAX_IMAGES_PER_BATCH} images).`);
      return;
    }
    if (incoming.length > capacity) {
      toast.warning(
        `Only ${capacity} more image${capacity === 1 ? "" : "s"} fit in this batch; ${incoming.length - capacity} skipped.`,
      );
    }

    const additions: SelectedFile[] = incoming.slice(0, capacity).map((file) => {
      const check = validateClientSide(file);
      return {
        id: nanoid(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "waiting" as CardStatus,
        reason: check.ok ? undefined : check.reason,
      };
    });
    selectedCount.current += additions.length;
    setSelected((prev) => [...prev, ...additions]);

    // The MIME type comes from the file extension, so also confirm the bytes
    // actually decode as an image (the server re-validates regardless).
    for (const added of additions) {
      if (added.reason) continue;
      createImageBitmap(added.file)
        .then((bitmap) => bitmap.close())
        .catch(() => {
          setSelected((prev) =>
            prev.map((f) =>
              f.id === added.id ? { ...f, reason: "Not a readable image" } : f,
            ),
          );
        });
    }
  }, []);

  const removeFile = useCallback((id: string) => {
    setSelected((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelected((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      return [];
    });
    setRecords(null);
    setSummary(null);
    setError(null);
    setProcessedCount(0);
  }, []);

  const readyFiles = useMemo(
    () => selected.filter((f) => !f.reason),
    [selected],
  );

  const runBatch = useCallback(async (files: SelectedFile[]) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setRecords(null);
    setSummary(null);
    setProcessedCount(0);
    setSelected((prev) =>
      prev.map((f) => (f.reason ? f : { ...f, status: "processing" })),
    );
    setProcessedFiles(files);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f.file, f.file.name));

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Extraction request failed");
      }

      const fileIndexToId = files.map((f) => f.id);
      let sawDone = false;

      await readEvents(response, (event) => {
        if (event.type === "card_stage") {
          const id = fileIndexToId[event.index];
          setSelected((prev) =>
            prev.map((f) => (f.id === id ? { ...f, stage: event.stage } : f)),
          );
        } else if (event.type === "card_completed" || event.type === "card_duplicate") {
          const id = fileIndexToId[event.index];
          setSelected((prev) =>
            prev.map((f) =>
              f.id === id ? { ...f, status: event.record.status, stage: undefined } : f,
            ),
          );
          setProcessedCount((c) => c + 1);
        } else if (event.type === "card_failed") {
          const id = fileIndexToId[event.index];
          setSelected((prev) =>
            prev.map((f) =>
              f.id === id
                ? { ...f, status: "failed", stage: undefined, reason: event.reason }
                : f,
            ),
          );
          setProcessedCount((c) => c + 1);
        } else if (event.type === "done") {
          sawDone = true;
          setRecords(event.records);
          setSummary(event.summary);
        } else if (event.type === "error") {
          sawDone = true;
          setError(event.message);
        }
      });
      if (!sawDone) {
        setError("The connection ended before extraction finished. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      // Anything still marked "processing" never got a result: let the user retry it.
      setSelected((prev) =>
        prev.map((f) => (f.status === "processing" ? { ...f, status: "waiting" } : f)),
      );
      setIsProcessing(false);
    }
  }, []);

  const startExtraction = useCallback(() => runBatch(readyFiles), [runBatch, readyFiles]);

  /** Adds images and runs the AI on them immediately (used by "Try a sample"). */
  const extractNow = useCallback(
    (incoming: File[]) => {
      const additions: SelectedFile[] = incoming.map((file) => ({
        id: nanoid(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "waiting" as CardStatus,
        reason: validateClientSide(file).reason,
      }));
      setSelected((prev) => [...prev, ...additions]);
      return runBatch([...readyFiles, ...additions.filter((f) => !f.reason)]);
    },
    [runBatch, readyFiles],
  );

  const [isImporting, setIsImporting] = useState(false);

  /** Loads a previously exported LeadLens .xlsx as a finished batch (no images, so no Retry). */
  const importExcel = useCallback(async (file: File) => {
    if (file.size > MAX_IMPORT_MB * 1024 * 1024) {
      toast.error(`That file is too large (${MAX_IMPORT_MB} MB maximum).`);
      return;
    }
    setIsImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const response = await fetch("/api/import", { method: "POST", body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.records) {
        throw new Error(body?.error ?? "Could not import that file.");
      }
      setSelected((prev) => {
        prev.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        return [];
      });
      setProcessedFiles([]);
      setProcessedCount(0);
      setRecords(body.records as LeadRecord[]);
      setSummary(body.summary as BatchSummary);
      toast.success(`Imported ${body.records.length} lead${body.records.length === 1 ? "" : "s"} from ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import that file.");
    } finally {
      setIsImporting(false);
    }
  }, []);

  const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(new Set());

  /** Re-runs extraction for one already-processed card and swaps in the new record. */
  const retryCard = useCallback(
    async (recordId: string) => {
      const index = records?.findIndex((r) => r.id === recordId) ?? -1;
      const source = index >= 0 ? processedFiles[index] : undefined;
      if (!source) {
        toast.error("The original image is no longer available to retry.");
        return;
      }
      setRetryingIds((prev) => new Set(prev).add(recordId));
      try {
        const formData = new FormData();
        formData.append("files", source.file, source.file.name);
        const response = await fetch("/api/extract", { method: "POST", body: formData });
        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "Retry request failed");
        }
        const result: { record: LeadRecord | null } = { record: null };
        await readEvents(response, (event) => {
          if (event.type === "done") result.record = event.records[0] ?? null;
        });
        const fresh = result.record;
        if (!fresh) throw new Error("The connection ended before the retry finished.");
        setRecords((prev) => (prev ? prev.map((r) => (r.id === recordId ? fresh : r)) : prev));
        if (fresh.status === "failed") {
          toast.error(fresh.failureReason ?? "Extraction failed again.");
        } else {
          toast.success(`Re-extracted ${source.file.name}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Retry failed");
      } finally {
        setRetryingIds((prev) => {
          const next = new Set(prev);
          next.delete(recordId);
          return next;
        });
      }
    },
    [records, processedFiles],
  );

  return {
    extractNow,
    importExcel,
    isImporting,
    retryCard,
    retryingIds,
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
    summary,
    error,
    processedFiles,
  };
}
