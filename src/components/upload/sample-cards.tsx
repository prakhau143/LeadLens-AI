"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

const SAMPLES = [
  { file: "modern-light-card.png", label: "Modern card", hint: "Light layout, all 7 fields" },
  { file: "full-details-card.png", label: "Detailed card", hint: "Different layout, all 7 fields" },
  { file: "dark-partial-card.jpg", label: "Dark card", hint: "No phone or location on the card" },
] as const;

/** Lets an evaluator try the app without having a card image to hand. */
export function SampleCards({
  onAdd,
  disabled,
}: {
  onAdd: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function add(sample: (typeof SAMPLES)[number]) {
    setLoading(sample.file);
    try {
      const response = await fetch(`/samples/${sample.file}`);
      if (!response.ok) throw new Error("sample not found");
      const blob = await response.blob();
      onAdd([new File([blob], sample.file, { type: blob.type })]);
    } catch {
      // A missing sample is not worth interrupting the user for; they can still upload.
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="size-4 text-brand" />
        <p className="text-sm font-medium">No card handy? Try a sample</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {SAMPLES.map((sample) => (
          <Button
            key={sample.file}
            type="button"
            variant="outline"
            disabled={disabled || loading !== null}
            onClick={() => add(sample)}
            className="h-auto flex-col items-start gap-0.5 px-3 py-2 text-left"
          >
            <span className="text-sm font-medium">{sample.label}</span>
            <span className="text-xs font-normal text-muted-foreground">{sample.hint}</span>
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Samples use the same free GPU quota as your own uploads (a few seconds each).
      </p>
    </div>
  );
}
