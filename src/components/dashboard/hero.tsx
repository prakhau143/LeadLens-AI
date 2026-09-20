import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="glass-card rounded-2xl px-6 py-14 sm:px-12 sm:py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium">
          <Sparkles className="size-3.5 text-brand" />
          Qwen3-VL Powered
        </span>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Turn business cards into structured leads.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-muted-foreground">
          Upload business cards. Let AI extract the details. Review, edit and
          export your leads in seconds.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button render={<Link href="/leads" />} nativeButton={false} size="lg">
            Upload Cards
            <ArrowRight />
          </Button>
          <Button
            render={<Link href="/history" />}
            nativeButton={false}
            size="lg"
            variant="outline"
          >
            View History
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          or{" "}
          <Link href="/leads" className="underline underline-offset-4 hover:text-foreground">
            try a sample card
          </Link>
        </p>
      </div>
    </section>
  );
}
