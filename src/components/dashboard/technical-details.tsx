import { ChevronDown } from "lucide-react";

const ROWS: { label: string; value: string }[] = [
  { label: "Model", value: "Qwen3-VL-4B-Instruct (bf16)" },
  { label: "Inference", value: "Hugging Face ZeroGPU (Gradio Space)" },
  { label: "Frontend & API", value: "Vercel · Next.js" },
  { label: "Observed GPU time", value: "2.5–3.6 s per card*" },
  { label: "Observed processing time", value: "5.9–9.8 s per card* (server-measured)" },
  { label: "Fields", value: "7 structured fields" },
  { label: "Export", value: "Excel (.xlsx)" },
];

/** Static, clearly caveated: these are three measured samples, not a benchmark. */
export function TechnicalDetails() {
  return (
    <details className="group glass-card rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Technical details
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/60 px-5 py-4">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {ROWS.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {row.label}
              </dt>
              <dd className="mt-0.5">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          * Range from about a dozen production runs on 20 Sep 2026 — a small sample, not a formal
          benchmark. Wall-clock time in the browser was longer on the slowest runs (13–18 s) because of cold starts and GPU queueing. AWS was not used; inference runs on Hugging Face ZeroGPU.
        </p>
      </div>
    </details>
  );
}
