"use client";

import { useState } from "react";
import { FlaskConical, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SAMPLES = [
  { id: "modern", file: "modern-light-card.png", label: "Modern", hint: "Light layout · all 7 fields" },
  { id: "minimal", file: "dark-partial-card.jpg", label: "Minimal", hint: "Dark · no phone or address (shows review)" },
  { id: "dense", file: "full-details-card.png", label: "Dense", hint: "Detailed layout · all 7 fields" },
] as const;

/**
 * Lets an evaluator try the app without a card image. The sample is uploaded and run
 * like any other image, so the result is real model output, never canned data.
 */
export function SampleCards({
  onRun,
  disabled,
}: {
  onRun: (file: File) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<(typeof SAMPLES)[number]["id"] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    const sample = SAMPLES.find((s) => s.id === selected);
    if (!sample) return;
    setLoading(true);
    try {
      const response = await fetch(`/samples/${sample.file}`);
      if (!response.ok) throw new Error("sample not found");
      const blob = await response.blob();
      onRun(new File([blob], sample.file, { type: blob.type }));
    } catch {
      // A missing sample is not worth interrupting the user for; they can still upload.
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="samples" className="glass-card scroll-mt-20 space-y-4 rounded-2xl p-4 sm:p-5" aria-labelledby="samples-heading">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 size-5 text-brand" aria-hidden />
        <div>
          <h2 id="samples-heading" className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Try a sample
          </h2>
          <p className="text-sm">Choose a business-card layout, then run the AI on it.</p>
        </div>
      </div>

      <div role="radiogroup" aria-labelledby="samples-heading" className="grid gap-2 sm:grid-cols-3">
        {SAMPLES.map((sample) => {
          const active = selected === sample.id;
          return (
            <button
              key={sample.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => setSelected(sample.id)}
              className={cn(
                "ll-lift min-h-11 rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-50",
                active ? "border-brand bg-brand/10" : "border-border bg-background/40 hover:bg-muted/50",
              )}
            >
              <span className="block text-sm font-medium">{sample.label}</span>
              <span className="block text-xs text-muted-foreground">{sample.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Samples use the same free GPU quota as your own uploads (a few seconds each).
        </p>
        <Button type="button" onClick={run} disabled={!selected || disabled || loading}>
          <Play />
          Run AI Extraction
        </Button>
      </div>
    </section>
  );
}
