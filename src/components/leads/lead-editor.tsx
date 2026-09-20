"use client";

import { useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SourceImagePreview } from "./source-image-preview";
import { LEAD_TABLE_COLUMNS, type Lead, type LeadRecord } from "@/lib/schemas/lead";
import { leadCompleteness } from "@/lib/utils/completeness";

function ms(value?: number): string {
  return value === undefined ? "—" : `${value.toLocaleString()} ms`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  );
}

function Missing() {
  return <span className="text-sm text-muted-foreground italic">Not detected</span>;
}

export function LeadEditor({
  record,
  previewUrl,
  open,
  onOpenChange,
  onSave,
}: {
  record: LeadRecord | null;
  previewUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Lead) => void;
}) {
  // Keyed by record.id at the call site, so a new record remounts this
  // component instead of needing an effect to resync local state.
  const [draft, setDraft] = useState<Lead | null>(record?.lead ?? null);
  // Cards with no extracted data (failed / duplicate) open straight into manual entry.
  const hasData = record?.status === "extracted" || record?.status === "needs_review";
  const [editing, setEditing] = useState(!hasData);

  if (!draft || !record) return null;

  const lead = record.lead;
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
  const { filled, total } = leadCompleteness(lead);
  const t = record.timings;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit Lead" : "Lead Details"}</SheetTitle>
          <SheetDescription>{record.sourceFileName}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          <SourceImagePreview previewUrl={previewUrl} />

          {editing ? (
            LEAD_TABLE_COLUMNS.map((col) => (
              <div key={col.key} className="space-y-1.5">
                <Label htmlFor={col.key}>{col.label}</Label>
                <Input
                  id={col.key}
                  value={draft[col.key] ?? ""}
                  placeholder="Not detected"
                  onChange={(e) =>
                    setDraft((prev) => (prev ? { ...prev, [col.key]: e.target.value } : prev))
                  }
                />
              </div>
            ))
          ) : (
            <>
              <div>
                <p className="font-heading text-xl font-semibold">{name || <Missing />}</p>
                <p className="text-sm text-muted-foreground">{lead.job_title ?? "Job title not detected"}</p>
                <p className="text-sm font-medium">{lead.company ?? "Company not detected"}</p>
              </div>

              <Field label="Extraction completeness">
                <div className="flex items-center gap-3">
                  <div
                    className="flex gap-1"
                    role="img"
                    aria-label={`${filled} of ${total} fields extracted`}
                  >
                    {Array.from({ length: total }, (_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-6 rounded-full ${i < filled ? "bg-brand" : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <span className="text-sm tabular-nums">
                    {filled} / {total} fields
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  A count of fields found on the card, not a model confidence score.
                </p>
              </Field>

              <Field label="Contact">
                <div className="space-y-1.5 text-sm">
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    {lead.phone ? <a className="hover:underline" href={`tel:${lead.phone}`}>{lead.phone}</a> : <Missing />}
                  </p>
                  <p className="flex items-center gap-2 break-all">
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    {lead.email ? <a className="hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : <Missing />}
                  </p>
                </div>
              </Field>

              <Field label="Location">
                <p className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {lead.location ?? <Missing />}
                </p>
              </Field>

              {t && (
                <details className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Processing details</summary>
                  <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
                    <dt className="text-muted-foreground">Image preparation</dt>
                    <dd>{ms(t.imagePreparationMs)}</dd>
                    <dt className="text-muted-foreground">Model request</dt>
                    <dd>{ms(t.modelRequestMs)}</dd>
                    <dt className="text-muted-foreground">GPU inference</dt>
                    <dd>{ms(t.modelInferenceMs)}</dd>
                    <dt className="text-muted-foreground">JSON parsing</dt>
                    <dd>{ms(t.parsingMs)}</dd>
                    <dt className="font-medium">Total</dt>
                    <dd className="font-medium">{ms(t.totalMs)}</dd>
                  </dl>
                </details>
              )}
            </>
          )}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          {editing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => (hasData ? setEditing(false) : onOpenChange(false))}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onSave(draft);
                  onOpenChange(false);
                }}
              >
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" onClick={() => setEditing(true)}>
                Edit Lead
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
