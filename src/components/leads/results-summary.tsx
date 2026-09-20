"use client";

import { AlertTriangle, CheckCircle2, Layers, XCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BatchSummary } from "@/lib/schemas/lead";

export function ResultsSummary({
  summary,
  onProcessMore,
  exportSlot,
}: {
  summary: BatchSummary;
  onProcessMore: () => void;
  exportSlot: React.ReactNode;
}) {
  const successful = summary.extracted;
  const attention = summary.needsReview + summary.failed;
  const tiles: { label: string; sub: string; value: number; icon: LucideIcon; tone: string }[] = [
    { label: "Total", sub: "cards processed", value: summary.total, icon: Layers, tone: "text-brand" },
    { label: "Successful", sub: "all fields found", value: successful, icon: CheckCircle2, tone: "text-success" },
    { label: "Needs review", sub: "missing or unclear fields", value: summary.needsReview, icon: AlertTriangle, tone: "text-warning" },
    { label: "Failed", sub: "could not be read", value: summary.failed, icon: XCircle, tone: "text-destructive" },
  ];

  return (
    <section className="glass-card ll-fade-up space-y-5 rounded-2xl p-4 sm:p-5" aria-labelledby="results-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="results-heading" className="font-heading text-lg font-semibold">
            Extraction complete
          </h2>
          <p className="text-sm text-muted-foreground">
            {attention === 0
              ? "Every card was read successfully."
              : `${attention} ${attention === 1 ? "card needs" : "cards need"} your attention.`}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {exportSlot}
          <Button type="button" variant="outline" onClick={onProcessMore}>
            Process More
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="ll-lift rounded-xl border border-border/60 bg-background/40 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{tile.label}</p>
                <Icon className={cn("size-4", tile.tone)} aria-hidden />
              </div>
              <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{tile.value}</p>
              <p className="text-xs text-muted-foreground">{tile.sub}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
