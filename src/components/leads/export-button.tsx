"use client";

import { useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
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
  const [phase, setPhase] = useState<"idle" | "preparing" | "done">("idle");

  async function handleExport() {
    setPhase("preparing");
    const toastId = toast.loading("Preparing your Excel file…");
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
      toast.success("Export complete", { id: toastId });
      setPhase("done");
      window.setTimeout(() => setPhase("idle"), 2200);
    } catch {
      toast.error("Couldn't generate the Excel file. Please try again.", { id: toastId });
      setPhase("idle");
    }
  }

  return (
    <Button type="button" onClick={handleExport} disabled={phase === "preparing"}>
      {phase === "preparing" ? <Loader2 className="animate-spin" /> : phase === "done" ? <Check className="ll-pop" /> : <Download />}
      {phase === "preparing" ? "Preparing…" : phase === "done" ? "Export complete" : "Export Excel"}
    </Button>
  );
}
