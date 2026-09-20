"use client";

import { useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { ClipboardPaste, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function UploadZone({
  onFilesAdded,
  onFilesRejected,
  disabled,
}: {
  onFilesAdded: (files: File[]) => void;
  /** Called with the names of files that are neither an image nor an .xlsx. */
  onFilesRejected?: (names: string[]) => void;
  disabled?: boolean;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFilesAdded(accepted);
    },
    [onFilesAdded],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => onFilesRejected?.(rejections.map((r) => r.file.name)),
    disabled,
    multiple: true,
    noClick: true, // the visible "Choose files" button opens the picker; keeps one clear control
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      [XLSX_MIME]: [".xlsx"],
    },
  });

  // Paste an image (screenshot, copied photo) straight into the page.
  useEffect(() => {
    if (disabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const images = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      event.preventDefault();
      const stamp = Date.now();
      onFilesAdded(
        images.map((f, i) => new File([f], `pasted-card-${stamp}-${i + 1}.${f.type.split("/")[1] || "png"}`, { type: f.type })),
      );
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, onFilesAdded]);

  return (
    <div
      {...getRootProps()}
      className={cn(
        "glass-card flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border px-5 py-10 text-center transition-all sm:py-12",
        isDragActive && "scale-[1.005] border-brand bg-brand/10",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input {...getInputProps()} aria-label="Upload business card images" />
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl bg-brand/12 text-brand transition-transform",
          isDragActive && "scale-110",
        )}
      >
        <UploadCloud className="size-7" aria-hidden />
      </div>
      <div>
        <p className="font-heading text-lg font-semibold">
          {isDragActive ? "Release to add your cards" : "Drop business cards here"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">or choose files from your device</p>
      </div>
      <Button type="button" size="lg" className="h-11 px-5 text-base sm:h-10 sm:text-sm" onClick={open} disabled={disabled}>
        Choose files
      </Button>
      <p className="text-sm text-muted-foreground">PNG, JPG, WEBP • Multiple files supported</p>
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-muted-foreground">
        <ClipboardPaste className="size-3.5" aria-hidden />
        Paste an image with Ctrl/⌘ + V, or import an exported <span className="font-medium">.xlsx</span>
      </p>
    </div>
  );
}
