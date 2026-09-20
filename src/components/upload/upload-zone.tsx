"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 50;

export function UploadZone({
  onFilesAdded,
  disabled,
}: {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFilesAdded(accepted);
    },
    [onFilesAdded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    multiple: true,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "glass-card flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-14 text-center transition-colors",
        isDragActive && "border-brand bg-brand/5",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input {...getInputProps()} />
      <div className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
        <UploadCloud className="size-6" />
      </div>
      <p className="font-medium">Drop business cards here</p>
      <p className="text-sm text-muted-foreground">JPG · PNG · WEBP</p>
      <Button type="button" variant="secondary" className="mt-2">
        Browse Files
      </Button>
      <p className="text-xs text-muted-foreground">
        Maximum {MAX_IMAGES} images per batch
      </p>
    </div>
  );
}
