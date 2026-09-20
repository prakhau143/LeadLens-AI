"use client";

import { useState } from "react";
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

  if (!draft) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Lead Details</SheetTitle>
          <SheetDescription>{record?.sourceFileName}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          <SourceImagePreview previewUrl={previewUrl} />

          {LEAD_TABLE_COLUMNS.map((col) => (
            <div key={col.key} className="space-y-1.5">
              <Label htmlFor={col.key}>{col.label}</Label>
              <Input
                id={col.key}
                value={draft[col.key] ?? ""}
                placeholder="Not detected"
                onChange={(e) =>
                  setDraft((prev) =>
                    prev ? { ...prev, [col.key]: e.target.value } : prev,
                  )
                }
              />
            </div>
          ))}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
