"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  ExternalLink,
  ListFilter,
  Loader2,
  Mail,
  Pencil,
  Phone,
  RotateCw,
  Search,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Lead, LeadRecord, LeadStatus } from "@/lib/schemas/lead";
import { LeadEditor } from "./lead-editor";
import { CompletenessLabel, displayName, STATUS_META, STATUS_ORDER, StatusBadge } from "./lead-view";

type StatusFilter = LeadStatus | "all";
type SortKey = "name" | "job_title" | "company" | "location" | "phone" | "email" | "status";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "job_title", label: "Job Title" },
  { key: "company", label: "Company" },
  { key: "location", label: "Location" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "status", label: "Status" },
];

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "extracted", label: "Success" },
  { value: "needs_review", label: "Needs review" },
  { value: "failed", label: "Failed" },
  { value: "duplicate", label: "Duplicate" },
];

function sortValue(r: LeadRecord, key: SortKey): string {
  if (key === "name") return displayName(r.lead) === "Unnamed lead" ? "" : displayName(r.lead);
  if (key === "status") return String(STATUS_ORDER.indexOf(r.status));
  return (r.lead[key] ?? "").toString();
}

const hasNoData = (r: LeadRecord) => r.status === "failed" || r.status === "duplicate";

export function LeadTable({
  records,
  previewUrls,
  onUpdateLead,
  onRetry,
  retryingIds,
}: {
  records: LeadRecord[];
  previewUrls: Record<string, string | undefined>;
  onUpdateLead: (id: string, lead: Lead) => void;
  /** Present only where the original image is still in memory (not History / imports). */
  onRetry?: (id: string) => void;
  retryingIds?: ReadonlySet<string>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [open, setOpen] = useState<{ id: string; mode: "view" | "edit" } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: records.length, extracted: 0, needs_review: 0, failed: 0, duplicate: 0 };
    for (const r of records) c[r.status] += 1;
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => {
        if (!query) return true;
        const haystack = [
          r.lead.first_name, r.lead.last_name, r.lead.job_title, r.lead.company,
          r.lead.email, r.lead.phone, r.lead.location, r.sourceFileName,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        // Failed/duplicate rows have no data; keep them at the bottom unless sorting by status.
        if (sortKey !== "status") {
          const rank = (r: LeadRecord) => (hasNoData(r) ? 1 : 0);
          if (rank(a) !== rank(b)) return rank(a) - rank(b);
        }
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        return sortAsc ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true });
      });
  }, [records, search, statusFilter, sortKey, sortAsc]);

  const editingRecord = open ? (records.find((r) => r.id === open.id) ?? null) : null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  /** Retry / Edit manually / View image, shared by the table row and the mobile card. */
  const failedActions = (record: LeadRecord) => {
    const previewUrl = previewUrls[record.id];
    const retrying = retryingIds?.has(record.id);
    return (
      <div
        className="flex flex-wrap gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {onRetry && previewUrl && record.status === "failed" && (
          <Button type="button" size="sm" variant="outline" disabled={retrying} onClick={() => onRetry(record.id)}>
            {retrying ? <Loader2 className="animate-spin" /> : <RotateCw />}
            Retry
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen({ id: record.id, mode: "edit" })}>
          <Pencil />
          Edit manually
        </Button>
        {previewUrl && (
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<a href={previewUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink />
            View image
          </Button>
        )}
      </div>
    );
  }

  const reviewMessage = (r: LeadRecord) =>
    r.status === "failed"
      ? (r.failureReason ?? "Qwen3-VL returned an incomplete or unreadable response.")
      : "Duplicate of an earlier image in this batch (skipped).";

  const activeFilterLabel = FILTERS.find((f) => f.value === statusFilter)?.label;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:w-full sm:max-w-sm">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search leads…"
              aria-label="Search leads"
              className="h-9 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="md:hidden"
            onClick={() => setFiltersOpen(true)}
            aria-label={`Filters and sort. Showing: ${activeFilterLabel}`}
          >
            <ListFilter />
            Filters
            {statusFilter !== "all" && <span className="size-1.5 rounded-full bg-brand" aria-hidden />}
          </Button>
        </div>

        <div className="hidden flex-wrap gap-1.5 md:flex" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={statusFilter === f.value ? "secondary" : "ghost"}
              aria-pressed={statusFilter === f.value}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
              <span className="text-muted-foreground tabular-nums">{counts[f.value]}</span>
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {filtered.length} of {records.length} {records.length === 1 ? "lead" : "leads"}
      </p>

      {filtered.length === 0 && (
        <div className="glass-card rounded-xl px-4 py-10 text-center text-sm text-muted-foreground">
          No leads match your search or filter.
        </div>
      )}

      {/* Desktop / tablet: table */}
      {filtered.length > 0 && (
        <div className="glass-card hidden overflow-hidden rounded-xl md:block [&_[data-slot=table-container]]:max-h-[70vh] [&_[data-slot=table-container]]:overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((col) => {
                  const active = sortKey === col.key;
                  return (
                    <TableHead
                      key={col.key}
                      className="sticky top-0 z-10 bg-card"
                      aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        className={cn("touch-target -mx-1 flex min-h-8 items-center gap-1 rounded px-1 hover:text-foreground", active && "text-foreground")}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        {active ? (sortAsc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-60" />}
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead className="sticky top-0 z-10 bg-card text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => {
                const selected = open?.id === record.id;
                return (
                  <TableRow
                    key={record.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted",
                      selected && "bg-brand/10",
                    )}
                    tabIndex={0}
                    aria-current={selected ? "true" : undefined}
                    aria-label={`${hasNoData(record) ? record.sourceFileName : displayName(record.lead)}. Press Enter to open.`}
                    onClick={() => setOpen({ id: record.id, mode: "view" })}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen({ id: record.id, mode: "view" });
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                      }
                    }}
                  >
                    {hasNoData(record) ? (
                      <TableCell colSpan={6} className="whitespace-normal">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{record.sourceFileName}</p>
                            <p className="text-sm">
                              <span className="font-medium">
                                {record.status === "failed" ? "Extraction needs review" : "Duplicate"}
                              </span>
                              <span className="text-muted-foreground"> — {reviewMessage(record)}</span>
                            </p>
                          </div>
                          {failedActions(record)}
                        </div>
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="font-medium">
                          <span className="block max-w-48 truncate" title={displayName(record.lead)}>
                            {displayName(record.lead)}
                          </span>
                        </TableCell>
                        {(["job_title", "company", "location", "phone", "email"] as const).map((key) => (
                          <TableCell
                            key={key}
                            title={record.lead[key] ?? undefined}
                            className={cn("max-w-56 truncate", !record.lead[key] && "text-muted-foreground")}
                          >
                            {record.lead[key] ?? "—"}
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`View details for ${hasNoData(record) ? record.sourceFileName : displayName(record.lead)}`}
                          onClick={() => setOpen({ id: record.id, mode: "view" })}
                        >
                          <Eye />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${hasNoData(record) ? record.sourceFileName : displayName(record.lead)}`}
                          onClick={() => setOpen({ id: record.id, mode: "edit" })}
                        >
                          <Pencil />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Phone: lead cards instead of a shrunken table */}
      {filtered.length > 0 && (
        <ul className="space-y-3 md:hidden" aria-label="Leads">
          {filtered.map((record) => (
            <li key={record.id} className="glass-card ll-lift space-y-3 rounded-2xl p-4">
              {hasNoData(record) ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium">{record.sourceFileName}</p>
                    <StatusBadge status={record.status} />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{record.status === "failed" ? "Extraction needs review" : "Duplicate"}</p>
                    <p className="text-muted-foreground">{reviewMessage(record)}</p>
                  </div>
                  {failedActions(record)}
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading text-base font-semibold break-words">{displayName(record.lead)}</h3>
                      <p className="text-sm text-muted-foreground break-words">{record.lead.job_title ?? "Job title not detected"}</p>
                      <p className="text-sm font-medium break-words">{record.lead.company ?? "Company not detected"}</p>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <CompletenessLabel lead={record.lead} />
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2 break-all">
                      <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {record.lead.email ?? <span className="text-muted-foreground">No email</span>}
                    </p>
                    {record.lead.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        {record.lead.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" className="flex-1" onClick={() => setOpen({ id: record.id, mode: "view" })}>
                      View Details
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setOpen({ id: record.id, mode: "edit" })}>
                      <Pencil />
                      Edit
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Mobile filter + sort sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-6">
          <SheetHeader>
            <SheetTitle>Filter and sort</SheetTitle>
            <SheetDescription>Choose which leads to show.</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4">
            <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-2">
              {FILTERS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={statusFilter === f.value}
                  variant={statusFilter === f.value ? "default" : "outline"}
                  onClick={() => {
                    setStatusFilter(f.value);
                    setFiltersOpen(false);
                  }}
                >
                  {f.value !== "all" && (() => {
                    const Icon = STATUS_META[f.value].icon;
                    return <Icon aria-hidden />;
                  })()}
                  {f.label} ({counts[f.value]})
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mobile-sort" className="text-sm font-medium">Sort by</label>
              <select
                id="mobile-sort"
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value as SortKey);
                  setSortAsc(true);
                }}
                className="touch-target h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <LeadEditor
        key={open ? `${open.id}-${open.mode}` : "none"}
        record={editingRecord}
        previewUrl={editingRecord ? previewUrls[editingRecord.id] : undefined}
        initialMode={open?.mode ?? "view"}
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        onSave={(lead) => {
          if (open) onUpdateLead(open.id, lead);
        }}
        onRetry={
          onRetry && editingRecord && previewUrls[editingRecord.id]
            ? () => onRetry(editingRecord.id)
            : undefined
        }
      />
    </div>
  );
}
