"use client";

import { useState } from "react";
import { Check, Copy, Mail, Phone, RotateCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { LEAD_TABLE_COLUMNS, type Lead, type LeadRecord } from "@/lib/schemas/lead";
import { isValidEmail } from "@/lib/services/validation-service";
import { leadCompleteness } from "@/lib/utils/completeness";
import { SourceImagePreview } from "./source-image-preview";
import { displayName, StatusBadge } from "./lead-view";

const ms = (value?: number) => (value === undefined ? "—" : `${value.toLocaleString()} ms`);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Value({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm break-words">
          {value ? value : <span className="text-muted-foreground italic">Not detected</span>}
        </p>
      </div>
      {children}
    </div>
  );
}

/** Copies to the clipboard and confirms with a check + a polite live-region message. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            // clipboard can be blocked (insecure context); nothing useful to show
          }
        }}
      >
        {copied ? <Check className="ll-pop text-success" /> : <Copy />}
      </Button>
      <span className="sr-only" role="status">{copied ? `${label} copied` : ""}</span>
    </>
  );
}

export function LeadEditor({
  record,
  previewUrl,
  open,
  onOpenChange,
  onSave,
  initialMode = "view",
  onRetry,
}: {
  record: LeadRecord | null;
  previewUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: Lead) => void;
  initialMode?: "view" | "edit";
  /** Present only when the original image is still available. */
  onRetry?: () => void;
}) {
  // Keyed by record.id + mode at the call site, so these initialise fresh each time.
  const narrow = useMediaQuery("(max-width: 767px)");
  const [draft, setDraft] = useState<Lead | null>(record?.lead ?? null);
  const hasData = record?.status === "extracted" || record?.status === "needs_review";
  // Cards with no extracted data (failed / duplicate) open straight into manual entry.
  const [editing, setEditing] = useState(initialMode === "edit" || !hasData);
  const [emailTouched, setEmailTouched] = useState(false);

  if (!draft || !record) return null;

  const lead = record.lead;
  const { filled, total } = leadCompleteness(lead);
  const t = record.timings;
  const modelName = record.model?.split("/").pop();
  const dirty = JSON.stringify(draft) !== JSON.stringify(lead);
  const emailBad = !!draft.email?.trim() && !isValidEmail(draft.email);
  const showEmailError = emailBad && emailTouched;
  const title = hasData ? displayName(lead) : record.sourceFileName;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={narrow ? "bottom" : "right"}
        className="w-full data-[side=bottom]:h-[92dvh] data-[side=bottom]:rounded-t-2xl sm:max-w-md"
      >
        <SheetHeader className="pr-14">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {editing ? "Edit Lead" : "Lead Details"}
          </p>
          <SheetTitle className="font-heading text-xl font-semibold">{title}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {!editing && hasData ? (lead.job_title ?? "Job title not detected") : record.sourceFileName}
            <StatusBadge status={record.status} />
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-2">
          <SourceImagePreview previewUrl={previewUrl} />

          {editing ? (
            <form
              id="lead-edit-form"
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setEmailTouched(true);
                if (emailBad) return;
                onSave(draft);
                onOpenChange(false);
              }}
            >
              {LEAD_TABLE_COLUMNS.map((col) => {
                const isEmail = col.key === "email";
                const isPhone = col.key === "phone";
                return (
                  <div key={col.key} className="space-y-1.5">
                    <Label htmlFor={`edit-${col.key}`}>{col.label}</Label>
                    <Input
                      id={`edit-${col.key}`}
                      value={draft[col.key] ?? ""}
                      placeholder="Not detected"
                      autoComplete="off"
                      inputMode={isEmail ? "email" : isPhone ? "tel" : "text"}
                      aria-invalid={isEmail && showEmailError ? true : undefined}
                      aria-describedby={isEmail && showEmailError ? "edit-email-error" : undefined}
                      onBlur={isEmail ? () => setEmailTouched(true) : undefined}
                      onChange={(e) => setDraft((prev) => (prev ? { ...prev, [col.key]: e.target.value } : prev))}
                    />
                    {isEmail && showEmailError && (
                      <p id="edit-email-error" className="text-xs text-destructive">
                        Enter a valid email address, or leave it empty.
                      </p>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Empty fields are allowed. Nothing is filled in for you.
              </p>
            </form>
          ) : (
            <>
              <Section title="Identity">
                <Value label="First name" value={lead.first_name} />
                <Value label="Last name" value={lead.last_name} />
                <Value label="Job title" value={lead.job_title} />
              </Section>

              <Section title="Company">
                <Value label="Company" value={lead.company} />
                <Value label="Location" value={lead.location} />
              </Section>

              <Section title="Contact">
                <Value label="Phone" value={lead.phone}>
                  {lead.phone && <CopyButton value={lead.phone} label="phone" />}
                </Value>
                <Value label="Email" value={lead.email}>
                  {lead.email && <CopyButton value={lead.email} label="email" />}
                </Value>
                {(lead.phone || lead.email) && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {lead.phone && (
                      <a className="inline-flex items-center gap-1 text-brand hover:underline" href={`tel:${lead.phone}`}>
                        <Phone className="size-3.5" aria-hidden /> Call
                      </a>
                    )}
                    {lead.email && (
                      <a className="inline-flex items-center gap-1 text-brand hover:underline" href={`mailto:${lead.email}`}>
                        <Mail className="size-3.5" aria-hidden /> Email
                      </a>
                    )}
                  </div>
                )}
              </Section>

              <Section title="Extraction">
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                    <span className="tabular-nums">{filled} / {total} fields</span>
                    <span className="ml-1 flex gap-0.5" role="img" aria-label={`${filled} of ${total} fields extracted`}>
                      {Array.from({ length: total }, (_, i) => (
                        <span key={i} className={`h-1 w-3 rounded-full ${i < filled ? "bg-brand" : "bg-muted"}`} />
                      ))}
                    </span>
                  </li>
                  {modelName && (
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                      {modelName}
                    </li>
                  )}
                  {t?.totalMs !== undefined && (
                    <li className="flex items-center gap-2 tabular-nums">
                      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                      {(t.totalMs / 1000).toFixed(2)} s processing time
                    </li>
                  )}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Fields found on the card — a count, not a model confidence score.
                </p>
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
              </Section>
            </>
          )}
        </div>

        <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t border-border/60">
          {editing ? (
            <>
              <span className="mr-auto text-xs text-muted-foreground" role="status">
                {dirty ? "Unsaved changes" : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => (hasData && initialMode !== "edit" ? setEditing(false) : onOpenChange(false))}
              >
                Cancel
              </Button>
              <Button type="submit" form="lead-edit-form" disabled={!dirty}>
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {onRetry && (
                <Button
                  type="button"
                  variant="outline"
                  title="Run the AI extraction again on the original image. This replaces the current values."
                  onClick={() => {
                    onRetry();
                    onOpenChange(false);
                  }}
                >
                  <RotateCw />
                  Retry
                </Button>
              )}
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
