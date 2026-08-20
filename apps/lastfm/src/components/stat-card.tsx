import { cn } from "@data-projects/shared";
import { Card } from "@data-projects/ui";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, hint, accent, className }: Readonly<StatCardProps>) {
  return (
    <Card className={cn("p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums tracking-tight",
          accent && "text-data"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
