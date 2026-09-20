import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const POINTS = ["Vision AI", "7-field extraction", "Excel export"];

export function Hero() {
  return (
    <section className="glass-card rounded-3xl px-5 py-10 sm:px-10 sm:py-14">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="ll-fade-up mb-5 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3.5 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase backdrop-blur">
          <Sparkles className="size-3.5 text-brand" aria-hidden />
          Qwen3-VL Powered
        </span>

        <h1
          className="ll-fade-up font-heading text-[2rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]"
          style={{ animationDelay: "70ms" }}
        >
          Turn business cards
          <br />
          <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">
            into structured leads.
          </span>
        </h1>

        <p
          className="ll-fade-up mt-4 max-w-xl text-base text-balance text-muted-foreground sm:text-lg"
          style={{ animationDelay: "140ms" }}
        >
          Upload business cards. AI extracts the details. Review, edit and export your leads in
          seconds.
        </p>

        <div
          className="ll-fade-up mt-7 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
          style={{ animationDelay: "210ms" }}
        >
          <Button render={<Link href="/leads" />} nativeButton={false} size="lg" className="h-11 px-5 text-base sm:h-10">
            Upload Cards
            <ArrowRight />
          </Button>
          <Button
            render={<Link href="/leads#samples" />}
            nativeButton={false}
            size="lg"
            variant="outline"
            className="h-11 px-5 text-base sm:h-10"
          >
            Try a Sample
          </Button>
        </div>

        <ul
          className="ll-fade-up mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          style={{ animationDelay: "280ms" }}
        >
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <Check className="size-4 text-success" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
