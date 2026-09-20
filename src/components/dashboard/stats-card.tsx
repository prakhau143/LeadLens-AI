import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatsCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
}) {
  return (
    <Card className="glass-card">
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-heading text-2xl font-semibold">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && <Icon className="size-8 text-brand/70" />}
      </CardContent>
    </Card>
  );
}
