import { cn } from "@/lib/utils";

/** Same mark as src/app/icon.svg: a business card with an AI sparkle. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <rect width="64" height="64" rx="14" className="fill-brand" />
      <rect
        x="12"
        y="22"
        width="34"
        height="24"
        rx="5"
        strokeWidth="3.5"
        className="stroke-brand-foreground"
      />
      <path
        d="M19 32h14M19 39h9"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="stroke-brand-foreground"
      />
      <path
        d="M46 8c.9 5.3 2.7 7.1 8 8-5.3.9-7.1 2.7-8 8-.9-5.3-2.7-7.1-8-8 5.3-.9 7.1-2.7 8-8Z"
        className="fill-brand-foreground"
      />
    </svg>
  );
}
