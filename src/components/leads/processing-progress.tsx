"use client";

import { Loader2 } from "lucide-react";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { FileList } from "@/components/upload/file-list";
import type { SelectedFile } from "@/hooks/use-extraction";

export function ProcessingProgress({
  files,
  processedCount,
  total,
}: {
  files: SelectedFile[];
  processedCount: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((processedCount / total) * 100);

  return (
    <div className="glass-card space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin text-brand" />
        <div>
          <p className="font-medium">AI Extraction in Progress</p>
          <p className="text-sm text-muted-foreground">
            Analyzing business cards with Qwen VLM
          </p>
        </div>
      </div>

      <Progress value={pct}>
        <ProgressLabel>
          {processedCount} of {total} cards completed
        </ProgressLabel>
        <ProgressValue />
      </Progress>

      <FileList files={files} readOnly />
    </div>
  );
}
