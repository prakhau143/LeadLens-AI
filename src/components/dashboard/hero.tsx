import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="glass-card glow-brand rounded-2xl px-6 py-12 text-center sm:px-12 sm:py-16">
      <p className="mb-3 text-sm font-medium text-brand">
        Powered by Qwen Vision-Language AI
      </p>
      <h1 className="mx-auto max-w-2xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        AI-Powered Business Card Extraction
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
        Turn physical business cards into structured, CRM-ready leads in
        seconds.
      </p>
      <Button
        render={<Link href="/leads" />}
        nativeButton={false}
        size="lg"
        className="mt-8"
      >
        Upload Business Cards
        <ArrowRight />
      </Button>
    </section>
  );
}
