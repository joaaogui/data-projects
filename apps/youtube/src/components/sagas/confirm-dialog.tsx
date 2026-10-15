"use client";

import { Button } from "@data-projects/ui";

export function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: Readonly<{
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={onCancel} />
      <dialog
        open
        className="fixed inset-y-4 left-4 right-4 z-[80] m-auto max-h-[calc(100dvh-2rem)] w-auto max-w-sm space-y-4 overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-xl animate-scale-in sm:p-6"
        onClose={onCancel}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      >
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Confirm</Button>
        </div>
      </dialog>
    </>
  );
}
