"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LEAD_TABLE_COLUMNS,
  type Lead,
  type LeadRecord,
  type LeadStatus,
} from "@/lib/schemas/lead";
import { LeadEditor } from "./lead-editor";

const STATUS_FILTERS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "extracted", label: "Extracted" },
  { value: "needs_review", label: "Needs Review" },
  { value: "failed", label: "Failed" },
  { value: "duplicate", label: "Duplicate" },
];

function statusVariant(status: LeadStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "extracted":
      return "default";
    case "needs_review":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export function LeadTable({
  records,
  previewUrls,
  onUpdateLead,
}: {
  records: LeadRecord[];
  previewUrls: Record<string, string | undefined>;
  onUpdateLead: (id: string, lead: Lead) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sortKey, setSortKey] = useState<keyof Lead>("first_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => {
        if (!query) return true;
        const haystack = [
          r.lead.first_name,
          r.lead.last_name,
          r.lead.company,
          r.lead.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        // Failed/duplicate rows have no data; keep them at the bottom.
        const rank = (r: LeadRecord) =>
          r.status === "failed" || r.status === "duplicate" ? 1 : 0;
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        const av = (a.lead[sortKey] ?? "").toString();
        const bv = (b.lead[sortKey] ?? "").toString();
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [records, search, statusFilter, sortKey, sortAsc]);

  const editingRecord = records.find((r) => r.id === editingId) ?? null;

  function toggleSort(key: keyof Lead) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            aria-label="Search leads"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={statusFilter === f.value ? "secondary" : "ghost"}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-xl [&_[data-slot=table-container]]:max-h-[70vh] [&_[data-slot=table-container]]:overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {LEAD_TABLE_COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className="sticky top-0 z-10 bg-card"
                  aria-sort={
                    sortKey === col.key
                      ? sortAsc
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 hover:text-foreground",
                      sortKey === col.key && "text-foreground",
                    )}
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                    <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
              ))}
              <TableHead className="sticky top-0 z-10 bg-card">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={LEAD_TABLE_COLUMNS.length + 1} className="py-8 text-center text-muted-foreground">
                  No leads match your filters.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((record) => (
              <TableRow
                key={record.id}
                className="cursor-pointer focus-visible:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                tabIndex={0}
                aria-label={`Edit ${record.sourceFileName}`}
                onClick={() => setEditingId(record.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditingId(record.id);
                  }
                }}
              >
                {record.status === "failed" || record.status === "duplicate" ? (
                  <TableCell
                    colSpan={LEAD_TABLE_COLUMNS.length}
                    className={cn(
                      "whitespace-normal",
                      record.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    <span className="font-medium">{record.sourceFileName}</span>
                    {" — "}
                    {record.status === "failed"
                      ? (record.failureReason ?? "Extraction failed")
                      : "Duplicate of an earlier image in this batch (skipped)"}
                    <span className="ml-1 text-muted-foreground">
                      Click to enter details manually.
                    </span>
                  </TableCell>
                ) : (
                  LEAD_TABLE_COLUMNS.map((col) => (
                    <TableCell
                      key={col.key}
                      title={record.lead[col.key] ?? undefined}
                      className={cn(
                        "max-w-56 truncate",
                        !record.lead[col.key] && "text-muted-foreground italic",
                      )}
                    >
                      {record.lead[col.key] ?? "—"}
                    </TableCell>
                  ))
                )}
                <TableCell>
                  <Badge variant={statusVariant(record.status)}>
                    {record.status.replace("_", " ")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LeadEditor
        key={editingRecord?.id ?? "none"}
        record={editingRecord}
        previewUrl={editingRecord ? previewUrls[editingRecord.id] : undefined}
        open={editingId !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        onSave={(lead) => {
          if (editingId) onUpdateLead(editingId, lead);
        }}
      />
    </div>
  );
}
