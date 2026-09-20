import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-muted/50">
        <Icon className="size-6 text-brand" />
      </div>
      <p className="font-heading text-lg font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
      {children}
    </div>
  );
}
