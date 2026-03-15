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
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={onCancel} />
      <dialog
        open
        className="fixed z-50 inset-0 m-auto bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 animate-scale-in"
        onClose={onCancel}
      >
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>Confirm</Button>
        </div>
      </dialog>
    </>
  );
}
