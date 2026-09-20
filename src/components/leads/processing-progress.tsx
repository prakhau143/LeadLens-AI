"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Circle, Loader2 } from "lucide-react";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { FileList } from "@/components/upload/file-list";
import type { SelectedFile } from "@/hooks/use-extraction";
import { cn } from "@/lib/utils";

/** The three stages the server actually reports; nothing here is simulated. */
const STAGE_MESSAGE = {
  queued: "Waiting to start…",
  preparing: "Preparing the image…",
  reading: "Analyzing card structure…",
  validating: "Checking the extracted fields…",
} as const;

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

/** Index of the stage the server last reported, or -1 while the card is still queued. */
function activeStep(file?: SelectedFile): number {
  return file?.stage ? STEPS.findIndex((s) => s.key === file.stage) : -1;
}

function StepRow({ label, state }: { label: string; state: "done" | "active" | "todo" }) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-6 text-sm transition-colors",
        state === "todo" ? "text-muted-foreground" : "text-foreground",
        state === "active" && "font-medium",
      )}
    >
      {label}
      {state === "done" ? (
        <Check className="size-4 text-emerald-500" aria-label="done" />
      ) : state === "active" ? (
        <Loader2 className="size-4 animate-spin text-brand" aria-label="in progress" />
      ) : (
        <Circle className="size-4" aria-label="pending" />
      )}
    </li>
  );
}

/** One segment per real stage: filled = passed, shimmering = current. No invented percentages. */
function StageBar({ active }: { active: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5" role="img" aria-label={`Step ${Math.max(active, 0) + 1} of ${STEPS.length}`}>
        {STEPS.map((step, i) => (
          <span
            key={step.key}
            className={cn(
              "h-1.5 flex-1 overflow-hidden rounded-full",
              i < active ? "bg-brand" : i === active ? "bg-brand/30" : "bg-muted",
            )}
          >
            {i === active && <span className="ll-shimmer block h-full w-full" />}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Step {Math.min(Math.max(active, 0) + 1, STEPS.length)} of {STEPS.length}
      </p>
    </div>
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
  const elapsed = useElapsedSeconds();
  const inFlight = files.filter((f) => !f.reason);
  const single = inFlight.length === 1;
  const active = activeStep(inFlight[0]);
  const pct = total === 0 ? 0 : Math.round((processedCount / total) * 100);

  return (
    <div className="glass-card ll-fade-up mx-auto w-full max-w-2xl space-y-6 rounded-3xl p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="ll-pulse-ring flex size-11 items-center justify-center rounded-full bg-brand/15">
          <span className="size-3 rounded-full bg-brand" />
        </span>
        <p className="text-xs font-semibold tracking-[0.16em] uppercase">
          AI extraction
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">{elapsed}s elapsed</p>
      </div>

      {single ? (
        <>
          {inFlight[0] && (
            <div className="relative mx-auto aspect-[16/10] w-full max-w-xs overflow-hidden rounded-xl border border-border/60 bg-muted">
              <Image
                src={inFlight[0].previewUrl}
                alt={`Card being analyzed: ${inFlight[0].file.name}`}
                fill
                sizes="320px"
                className="object-contain"
                unoptimized
              />
              {inFlight[0].stage === "reading" && <span className="ll-scan" aria-hidden />}
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground" role="status">
            <span className="font-medium text-foreground">Qwen3-VL</span> · {STAGE_MESSAGE[inFlight[0]?.stage ?? "queued"]}
          </p>
          <ol className="space-y-3.5">
            {STEPS.map((step, i) => (
              <StepRow
                key={step.key}
                label={step.label}
                state={i < active ? "done" : i === active ? "active" : "todo"}
              />
            ))}
          </ol>
          <StageBar active={active} />
        </>
      ) : (
        <>
          <Progress value={pct}>
            <ProgressLabel>
              {processedCount} / {total} completed
            </ProgressLabel>
            <ProgressValue />
          </Progress>
          <FileList files={files} readOnly />
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">Progress reflects real processing stages. Powered by Qwen3-VL.</p>
    </div>
  );
}
