"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/** Sheet controls are ≥ 44 px tall on touch screens; the bar keeps a compact 32 px. */
const TOUCH = "min-h-11 sm:min-h-8";

export function formatCount(n: number | undefined): string | null {
  if (n === undefined) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")}k` : String(n);
}

export function Chip({
  active,
  onClick,
  children,
  count,
  icon,
  size = "sheet",
  title,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  icon?: ReactNode;
  size?: "sheet" | "bar";
  title?: string;
  className?: string;
}) {
  const countLabel = formatCount(count);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors ${
        size === "bar" ? "h-9 sm:h-8" : TOUCH
      } ${
        active
          ? "border-primary/40 bg-accent text-accent-foreground"
          : "bg-card text-foreground hover:bg-secondary"
      } ${className}`}
    >
      {icon}
      <span>{children}</span>
      {countLabel !== null && (
        <span
          className={`font-mono text-[11px] font-medium ${active ? "opacity-75" : "text-muted-foreground"}`}
        >
          {countLabel}
        </span>
      )}
    </button>
  );
}

export function Segmented<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
  multiple = false,
  values,
  onToggle,
}: {
  label: string;
  options: { value: T; label: ReactNode; count?: number; title?: string }[];
  value?: T;
  onChange?: (v: T) => void;
  multiple?: boolean;
  values?: T[];
  onToggle?: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border bg-background p-0.5"
    >
      {options.map((opt) => {
        const active = multiple ? (values ?? []).includes(opt.value) : value === opt.value;
        const countLabel = formatCount(opt.count);
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            title={opt.title}
            onClick={() => (multiple ? onToggle?.(opt.value) : onChange?.(opt.value))}
            className={`inline-flex items-center gap-1 rounded-md px-3 text-xs font-semibold transition-colors ${TOUCH} ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
            {countLabel !== null && (
              <span className="font-mono text-[10px] font-medium opacity-70">{countLabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  testId,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
  testId?: string;
}) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 text-xs font-medium ${TOUCH}`}>
      <span className="min-w-0">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        data-testid={testId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full border bg-secondary transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

export function Section({
  title,
  activeCount,
  summary,
  defaultOpen = true,
  children,
}: {
  title: string;
  activeCount: number;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || activeCount > 0);
  const id = useId();
  return (
    <section className="border-b py-3.5 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-between gap-2 text-left text-[13px] font-bold ${TOUCH}`}
        >
          <span>{title}</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            {activeCount > 0 ? `${activeCount} ${activeCount === 1 ? "ativo" : "ativos"}` : !open ? summary : null}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>
      </h3>
      {open && (
        <div id={id} className="mt-2 flex flex-col gap-3">
          {children}
        </div>
      )}
    </section>
  );
}

const SLIDER_MIN = 1500;
const SLIDER_MAX = 8000;
const SLIDER_STEP = 100;

/** Single "up to" slider for the monthly total, with ideal/cap marks; exact min/max behind "editar". */
export function PriceRange({
  min,
  max,
  onChange,
  ideal = 4500,
  cap = 5000,
}: {
  min: number | null;
  max: number | null;
  onChange: (next: { min: number | null; max: number | null }) => void;
  ideal?: number;
  cap?: number;
}) {
  const [editing, setEditing] = useState(min !== null);
  const pct = (v: number) => ((v - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
  const shown = max ?? SLIDER_MAX;
  const brl = (n: number) => n.toLocaleString("pt-BR");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground">
        <span>
          Valor total mensal (aluguel + cond. + IPTU) —{" "}
          <b className="font-mono text-primary">
            {max === null && min === null
              ? "qualquer"
              : min !== null && max !== null
                ? `R$ ${brl(min)}–${brl(max)}`
                : max !== null
                  ? `até R$ ${brl(max)}`
                  : `≥ R$ ${brl(min!)}`}
          </b>
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="min-h-11 shrink-0 px-1 text-primary underline underline-offset-2 sm:min-h-0"
        >
          {editing ? "fechar" : "editar"}
        </button>
      </div>
      <div className="relative h-16 sm:h-9">
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={SLIDER_STEP}
          aria-label="Valor total mensal máximo"
          value={shown}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ min, max: v >= SLIDER_MAX ? null : v });
          }}
          className="absolute inset-x-0 top-1 h-6 w-full accent-primary"
        />
        {[
          { v: ideal, label: "ideal" },
          { v: cap, label: "teto" },
        ].map((mark) => (
          <button
            key={mark.label}
            type="button"
            onClick={() => onChange({ min, max: mark.v })}
            title={`Até R$ ${brl(mark.v)}`}
            className="absolute top-5 flex h-11 -translate-x-1/2 items-start px-1 pt-1 sm:top-6 sm:h-auto sm:pt-0 text-[10px] font-semibold text-amber-700 hover:underline dark:text-amber-300"
            style={{ left: `${pct(mark.v)}%` }}
          >
            {mark.label}
          </button>
        ))}
      </div>
      {editing && (
        <div className="flex items-center gap-2 font-mono text-xs">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            placeholder="Mín"
            aria-label="Valor mensal mínimo"
            value={min ?? ""}
            onChange={(e) => onChange({ min: e.target.value === "" ? null : Number(e.target.value), max })}
            className={`w-24 rounded-md border bg-background px-2 text-right ${TOUCH}`}
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            placeholder="Máx"
            aria-label="Valor mensal máximo"
            value={max ?? ""}
            onChange={(e) => onChange({ min, max: e.target.value === "" ? null : Number(e.target.value) })}
            className={`w-24 rounded-md border bg-background px-2 text-right ${TOUCH}`}
          />
        </div>
      )}
    </div>
  );
}
