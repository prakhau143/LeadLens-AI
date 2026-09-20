"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileStack, TrendingUp, Users } from "lucide-react";
import { StatsCard } from "./stats-card";
import { aggregateStats, loadHistory } from "@/lib/utils/history";

export function DashboardStats() {
  const [stats, setStats] = useState({ cards: 0, leads: 0, successRate: 0, needsReview: 0, failed: 0 });

  useEffect(() => {
    // localStorage doesn't exist during SSR; reading it after mount (rather
    // than in a lazy initializer) keeps the server and first client render
    // identical and avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(aggregateStats(loadHistory()));
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatsCard label="Cards Processed" value={stats.cards} icon={FileStack} />
      <StatsCard label="Leads Extracted" value={stats.leads} icon={Users} />
      <StatsCard
        label="Extraction Success Rate"
        value={`${stats.successRate}%`}
        icon={TrendingUp}
      />
      <StatsCard
        label="Needs Review"
        value={stats.needsReview}
        icon={AlertTriangle}
        hint={stats.failed > 0 ? `${stats.failed} failed` : stats.needsReview > 0 ? "Check missing fields" : "Nothing pending"}
      />
    </div>
  );
}
