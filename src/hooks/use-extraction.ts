"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import type { BatchSummary, LeadRecord } from "@/lib/schemas/lead";
import type { ExtractionEvent } from "@/lib/schemas/extraction";

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
  reason?: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_CLIENT_SIZE_MB = 8;
export const MAX_IMAGES_PER_BATCH = 50;

function validateClientSide(file: File): { ok: boolean; reason?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, reason: "Unsupported file type" };
  }
  if (file.size > MAX_CLIENT_SIZE_MB * 1024 * 1024) {
    return { ok: false, reason: `Exceeds ${MAX_CLIENT_SIZE_MB}MB limit` };
  }
  return { ok: true };
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

  const startExtraction = useCallback(async () => {
    if (readyFiles.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setRecords(null);
    setSummary(null);
    setProcessedCount(0);
    setSelected((prev) =>
      prev.map((f) => (f.reason ? f : { ...f, status: "processing" })),
    );
    setProcessedFiles(readyFiles);

    const formData = new FormData();
    readyFiles.forEach((f) => formData.append("files", f.file, f.file.name));

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Extraction request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const fileIndexToId = readyFiles.map((f) => f.id);
      let sawDone = false;

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

          let event: ExtractionEvent;
          try {
            event = JSON.parse(jsonText);
          } catch {
            continue;
          }

          if (event.type === "card_completed" || event.type === "card_duplicate") {
            const id = fileIndexToId[event.index];
            setSelected((prev) =>
              prev.map((f) =>
                f.id === id ? { ...f, status: event.record.status } : f,
              ),
            );
            setProcessedCount((c) => c + 1);
          } else if (event.type === "card_failed") {
            const id = fileIndexToId[event.index];
            setSelected((prev) =>
              prev.map((f) =>
                f.id === id
                  ? { ...f, status: "failed", reason: event.reason }
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
        }
      }
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
  }, [readyFiles]);

  return {
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
