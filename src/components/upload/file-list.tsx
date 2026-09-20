"use client";

import Image from "next/image";
import { AlertTriangle, CheckCircle2, Circle, Copy, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SelectedFile } from "@/hooks/use-extraction";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Labels for the real server stages; "queued" = accepted but not started yet. */
const STAGE_LABELS = {
  queued: "Waiting",
  preparing: "Preparing image…",
  reading: "Reading card…",
  validating: "Validating…",
} as const;

function StatusIndicator({ file }: { file: SelectedFile }) {
  if (file.reason) {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <XCircle className="size-3.5" aria-hidden /> {file.reason}
      </span>
    );
  }
  switch (file.status) {
    case "processing":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> {STAGE_LABELS[file.stage ?? "queued"]}
        </span>
      );
    case "extracted":
      return (
        <span className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="size-3.5" aria-hidden /> Complete
        </span>
      );
    case "needs_review":
      return (
        <span className="flex items-center gap-1 text-xs text-warning">
          <AlertTriangle className="size-3.5" aria-hidden /> Needs review
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <XCircle className="size-3.5" aria-hidden /> Failed
        </span>
      );
    case "duplicate":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Copy className="size-3.5" aria-hidden /> Duplicate
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Circle className="size-3.5" aria-hidden /> Ready
        </span>
      );
  }
}

export function FileList({
  files,
  onRemove,
  onClear,
  readOnly,
}: {
  files: SelectedFile[];
  onRemove?: (id: string) => void;
  onClear?: () => void;
  readOnly?: boolean;
}) {
  if (files.length === 0) return null;
  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium" aria-live="polite">
          {files.length} {files.length === 1 ? "card" : "cards"}
          <span className="font-normal text-muted-foreground"> · {formatSize(totalBytes)} total</span>
        </p>
        {!readOnly && onClear && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear all
          </Button>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {files.map((f) => (
          <li key={f.id} className="glass-card ll-lift flex items-center gap-3 rounded-xl p-2.5">
            <div className="relative h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-muted">
              <Image
                src={f.previewUrl}
                alt={`Preview of ${f.file.name}`}
                fill
                sizes="72px"
                className="object-cover"
                unoptimized
              />
              {f.status === "processing" && f.stage === "reading" && <span className="ll-scan" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={f.file.name}>{f.file.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(f.file.size)}</p>
              <StatusIndicator file={f} />
            </div>
            {!readOnly && onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${f.file.name}`}
                onClick={() => onRemove(f.id)}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
