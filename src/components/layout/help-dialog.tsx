"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STEPS = [
  ["Upload", "Drop business-card images (JPG, PNG, WEBP), paste one, or try a sample. An exported .xlsx can be re-opened too."],
  ["Extract", "Qwen3-VL reads each card. You see the real stage it is in — nothing is simulated."],
  ["Review", "Cards with missing fields are flagged. Open any lead to check it against the photo and edit it."],
  ["Export", "Download an Excel file with the 7 columns: name, title, company, location, phone, email."],
] as const;

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="touch-target" aria-label="Help" />}
      >
        <CircleHelp />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How LeadLens works</DialogTitle>
          <DialogDescription>From card photo to Excel in four steps.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
                {i + 1}
              </span>
              <span>
                <span className="font-medium">{title}.</span>{" "}
                <span className="text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          The AI runs on a free GPU tier with a small daily quota. If it is used up, cards will say
          so and you can retry after it resets. Press <kbd className="rounded border px-1">Esc</kbd> to
          close any panel.
        </p>
      </DialogContent>
    </Dialog>
  );
}
