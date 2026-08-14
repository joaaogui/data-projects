"use client";

import { CheckCircle2, XCircle, Activity } from "lucide-react";

export interface ToastItem {
  id: string;
  message: string;
  variant: "success" | "error" | "info";
}

export interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  destructive: boolean;
  onConfirm: () => void;
}

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  const cfg: Record<string, { dot: string; text: string; label: string }> = {
    pending: { dot: "bg-foreground/40", text: "text-muted-foreground", label: "Pending" },
    running: { dot: "bg-foreground/40 animate-pulse", text: "text-muted-foreground", label: "Running" },
    completed: { dot: "bg-foreground/40", text: "text-muted-foreground", label: "Completed" },
    failed: { dot: "bg-destructive", text: "text-destructive", label: "Failed" },
  };
  const c = cfg[status] ?? { dot: "bg-muted-foreground", text: "text-muted-foreground", label: status };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function Toasts({
  items,
  onDismiss,
}: Readonly<{ items: ToastItem[]; onDismiss: (id: string) => void }>) {
  if (items.length === 0) return null;

  const variantClass: Record<ToastItem["variant"], string> = {
    success: "border-border bg-muted text-muted-foreground",
    error: "border-destructive/20 bg-destructive/5 text-destructive",
    info: "border-primary/20 bg-primary/5 text-primary",
  };

  const variantIcon: Record<ToastItem["variant"], React.ReactNode> = {
    success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    error: <XCircle className="h-4 w-4 shrink-0" />,
    info: <Activity className="h-4 w-4 shrink-0" />,
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onDismiss(t.id)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg cursor-pointer transition-opacity hover:opacity-80 text-left ${variantClass[t.variant]}`}
        >
          {variantIcon[t.variant]}
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}

export function healthColor(percentage: number): string {
  if (percentage >= 80) return "bg-foreground/40";
  if (percentage >= 50) return "bg-foreground/40";
  return "bg-destructive";
}

export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}
