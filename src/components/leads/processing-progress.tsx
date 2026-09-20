"use client";

import { useEffect, useState } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { FileList } from "@/components/upload/file-list";
import type { SelectedFile } from "@/hooks/use-extraction";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "preparing", label: "Preparing image" },
  { key: "reading", label: "Reading card & extracting fields" },
  { key: "validating", label: "Validating result" },
] as const;

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

/** Stepper driven only by the stage the server last reported for this card. */
function StageStepper({ file }: { file: SelectedFile }) {
  const activeIndex = file.stage ? STEPS.findIndex((s) => s.key === file.stage) : -1;
  return (
    <ol className="space-y-2">
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li
            key={step.key}
            className={cn(
              "flex items-center gap-2.5 text-sm transition-colors",
              done && "text-foreground",
              active && "font-medium text-foreground",
              !done && !active && "text-muted-foreground",
            )}
          >
            {done ? (
              <Check className="size-4 text-emerald-500" />
            ) : active ? (
              <Loader2 className="size-4 animate-spin text-brand" />
            ) : (
              <Circle className="size-4" />
            )}
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

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
  const elapsed = useElapsedSeconds();
  const single = files.filter((f) => !f.reason).length === 1;
  const only = files.find((f) => !f.reason);

  return (
    <div className="glass-card space-y-5 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-brand" />
          <div>
            <p className="font-medium">Analyzing business {single ? "card" : "cards"}…</p>
            <p className="text-sm text-muted-foreground">
              Qwen3-VL is reading each card. Steps below are reported by the server.
            </p>
          </div>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{elapsed}s</span>
      </div>

      {single && only && <StageStepper file={only} />}

      <Progress value={pct}>
        <ProgressLabel>
          {processedCount} / {total} completed
        </ProgressLabel>
        <ProgressValue />
      </Progress>

      <FileList files={files} readOnly />
    </div>
  );
}
