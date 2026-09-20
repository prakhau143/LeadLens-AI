import { AlertTriangle, CheckCircle2, Copy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/lib/schemas/lead";
import { leadCompleteness } from "@/lib/utils/completeness";

export function displayName(lead: Lead): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unnamed lead";
}

/** Status is always shown as icon + text, never colour alone. */
export const STATUS_META: Record<
  LeadStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  extracted: { label: "Success", icon: CheckCircle2, className: "bg-success/15 text-success" },
  needs_review: { label: "Needs review", icon: AlertTriangle, className: "bg-warning/15 text-warning" },
  failed: { label: "Failed", icon: XCircle, className: "bg-destructive/15 text-destructive" },
  duplicate: { label: "Duplicate", icon: Copy, className: "bg-muted text-muted-foreground" },
};

export const STATUS_ORDER: LeadStatus[] = ["extracted", "needs_review", "failed", "duplicate"];

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

/** "7/7 fields" with a tick when complete. A field count, not an AI confidence. */
export function CompletenessLabel({ lead, className }: { lead: Lead; className?: string }) {
  const { filled, total } = leadCompleteness(lead);
  const full = filled === total;
  const Icon = full ? CheckCircle2 : AlertTriangle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        full ? "text-success" : "text-warning",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {filled}/{total} fields
    </span>
  );
}
