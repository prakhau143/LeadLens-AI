import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const FLOW = ["Upload cards", "AI extracts", "Review", "Export"];
const POINTS = ["7-field extraction", "AI-powered vision", "Excel export"];

export function Hero() {
  return (
    <section className="glass-card hero-backdrop rounded-3xl px-6 py-16 sm:px-12 sm:py-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="ll-fade-up mb-6 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3.5 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase backdrop-blur">
          <Sparkles className="size-3.5 text-brand" />
          Qwen3-VL Powered
        </span>

        <h1
          className="ll-fade-up font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Turn business cards
          <br />
          <span className="text-brand">into structured leads.</span>
        </h1>

        <ol
          aria-label="How it works"
          className="ll-fade-up mt-6 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm text-muted-foreground"
          style={{ animationDelay: "160ms" }}
        >
          {FLOW.map((step, i) => (
            <li key={step} className="flex items-center gap-1">
              <span className={i === 1 ? "font-medium text-foreground" : undefined}>{step}</span>
              {i < FLOW.length - 1 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
            </li>
          ))}
        </ol>

        <div
          className="ll-fade-up mt-9 flex flex-col items-center gap-3 sm:flex-row"
          style={{ animationDelay: "240ms" }}
        >
          <Button render={<Link href="/leads" />} nativeButton={false} size="lg">
            Upload Cards
            <ArrowRight />
          </Button>
          <Button
            render={<Link href="/leads#samples" />}
            nativeButton={false}
            size="lg"
            variant="outline"
          >
            Try a Sample
          </Button>
        </div>

        <ul
          className="ll-fade-up mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          style={{ animationDelay: "320ms" }}
        >
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <Check className="size-4 text-emerald-500" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
