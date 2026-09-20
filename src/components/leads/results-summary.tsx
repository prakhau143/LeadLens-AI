"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const tiles = [
    { label: "Processed", value: summary.total },
    { label: "Extracted", value: summary.extracted },
    { label: "Needs Review", value: summary.needsReview },
    { label: "Failed", value: summary.failed },
  ];

  return (
    <div className="glass-card space-y-5 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-emerald-500" />
        <p className="font-medium">Extraction Complete</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border/60 p-3 text-center">
            <p className="font-heading text-xl font-semibold">{tile.value}</p>
            <p className="text-xs text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {exportSlot}
        <Button type="button" variant="outline" onClick={onProcessMore}>
          Process More
        </Button>
      </div>
    </div>
  );
}
