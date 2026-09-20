"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BatchSummary, LeadRecord } from "@/lib/schemas/lead";

export function ExportButton({
  leads,
  summary,
}: {
  leads: LeadRecord[];
  summary: BatchSummary;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads, summary }),
      });
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leadlens-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't generate the Excel file. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : <Download />}
      Export Excel
    </Button>
  );
}
