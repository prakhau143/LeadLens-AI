"use client";

import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Copy,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SelectedFile } from "@/hooks/use-extraction";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusIndicator({ file }: { file: SelectedFile }) {
  if (file.reason) {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <XCircle className="size-3.5" /> {file.reason}
      </span>
    );
  }
  switch (file.status) {
    case "processing":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Analyzing...
        </span>
      );
    case "extracted":
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-500">
          <CheckCircle2 className="size-3.5" /> Extracted
        </span>
      );
    case "needs_review":
      return (
        <span className="flex items-center gap-1 text-xs text-amber-500">
          <AlertTriangle className="size-3.5" /> Needs review
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <XCircle className="size-3.5" /> Failed
        </span>
      );
    case "duplicate":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Copy className="size-3.5" /> Duplicate
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Circle className="size-3.5" /> Ready
        </span>
      );
  }
}

export function FileList({
  files,
  onRemove,
  readOnly,
}: {
  files: SelectedFile[];
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}) {
  if (files.length === 0) return null;

  return (
    <div className="glass-card divide-y divide-border/60 rounded-xl">
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-3 px-3 py-2">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image
              src={f.previewUrl}
              alt={f.file.name}
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{f.file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(f.file.size)}
            </p>
          </div>
          <StatusIndicator file={f} />
          {!readOnly && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${f.file.name}`}
              onClick={() => onRemove(f.id)}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
