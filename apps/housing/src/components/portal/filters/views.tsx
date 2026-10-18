"use client";

import { useFilterSelector, type FilterStore } from "@/components/portal/filter-store";
import { Chip } from "@/components/portal/filters/controls";
import type { PortalController } from "@/components/portal/use-portal-controller";
import { applyPresetFilters, isPresetActive } from "@/lib/filter-state";
import { Check, ChevronDown, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** "Visões ▾": apply (or turn off) a saved view, save the current filters, rename and delete. */
export function ViewsMenu({ ctl }: { ctl: PortalController }) {
  const { viewPresets, toggleView, saveCurrentView, renameView, deleteView, filterState } = ctl;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; name: string } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (name) {
      if (editing.id) renameView(editing.id, name);
      else saveCurrentView(name);
    }
    setEditing(null);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1 rounded-full border bg-card px-3 text-xs font-semibold hover:bg-secondary sm:h-8"
      >
        Visões
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Visões salvas"
          className="absolute right-0 z-40 mt-1.5 w-72 rounded-xl border bg-card p-1.5 shadow-xl"
        >
          {viewPresets.map((view) => {
            const active = isPresetActive(filterState, view.preset);
            if (editing?.id === view.id) {
              return (
                <ViewNameInput
                  key={view.id}
                  value={editing.name}
                  onChange={(name) => setEditing({ id: view.id, name })}
                  onSubmit={commit}
                  onCancel={() => setEditing(null)}
                />
              );
            }
            return (
              <div key={view.id} className="flex items-center gap-1">
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={active}
                  onClick={() => {
                    toggleView(view.id);
                    setOpen(false);
                  }}
                  className="flex min-h-11 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold hover:bg-secondary sm:min-h-9"
                >
                  {view.builtin ? (
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                  <span className="flex-1 truncate">{view.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
                {!view.builtin && (
                  <>
                    <button
                      type="button"
                      aria-label={`Renomear ${view.name}`}
                      onClick={() => setEditing({ id: view.id, name: view.name })}
                      className="inline-flex h-11 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground sm:h-9"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir ${view.name}`}
                      onClick={() => deleteView(view.id)}
                      className="inline-flex h-11 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 sm:h-9"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          <div className="mt-1 border-t pt-1">
            {editing && editing.id === null ? (
              <ViewNameInput
                value={editing.name}
                onChange={(name) => setEditing({ id: null, name })}
                onSubmit={commit}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing({ id: null, name: "" })}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-secondary sm:min-h-9"
              >
                <Plus className="h-3.5 w-3.5" />
                Salvar filtros atuais
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ViewNameInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="flex items-center gap-1 p-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        autoFocus
        value={value}
        maxLength={60}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder="Nome da visão"
        aria-label="Nome da visão"
        className="min-h-11 flex-1 rounded-lg border bg-background px-2.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-primary sm:min-h-8"
      />
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground sm:min-h-8"
      >
        Salvar
      </button>
    </form>
  );
}

/** Views as chips at the top of the filter sheet: they fill the draft (applied with "Ver N imóveis"). */
export function SheetViews({ ctl, draft }: { ctl: PortalController; draft: FilterStore }) {
  const state = useFilterSelector(draft, (s) => s);
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b px-4 py-2 [scrollbar-width:none] sm:px-5">
      <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Visões
      </span>
      {ctl.viewPresets.map((view) => (
        <Chip
          key={view.id}
          active={isPresetActive(state, view.preset)}
          onClick={() => draft.setState(applyPresetFilters(state, view.preset))}
          icon={view.builtin ? <Sparkles className="h-3.5 w-3.5 text-amber-500" /> : undefined}
        >
          {view.name}
        </Chip>
      ))}
    </div>
  );
}
