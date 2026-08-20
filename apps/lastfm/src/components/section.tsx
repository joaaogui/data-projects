import { cn } from "@data-projects/shared";
import { Card } from "@data-projects/ui";

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Section({
  title,
  description,
  children,
  actions,
  className,
  bodyClassName,
}: Readonly<SectionProps>) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

export function EmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
  );
}
