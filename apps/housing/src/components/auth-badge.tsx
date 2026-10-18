"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const DISMISS_KEY = "housing:auth-badge-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * In-flow notice at the top of the page while the browser has no session (writes would get 401).
 * Rendered into a slot prepended to #main-content so it never floats over cards, map or drawers.
 */
export function AuthBadge() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - dismissedAt < DISMISS_MS) return;
    const controller = new AbortController();
    let container: HTMLDivElement | null = null;
    fetch("/api/auth/session", { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean; authenticated?: boolean } | null) => {
        if (!data?.configured || data.authenticated) return;
        const main = document.getElementById("main-content");
        if (!main) return;
        container = document.createElement("div");
        main.prepend(container);
        setSlot(container);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      container?.remove();
    };
  }, []);

  if (!slot) return null;
  return createPortal(
    <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200">
      <a href="/login?next=/" className="font-medium underline-offset-2 hover:underline">
        Entrar para salvar filtros, favoritos e perguntar
      </a>
      <button
        type="button"
        aria-label="Dispensar aviso de login"
        onClick={() => {
          window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
          setSlot(null);
        }}
        className="rounded px-1.5 py-0.5 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
      >
        ✕
      </button>
    </div>,
    slot,
  );
}
