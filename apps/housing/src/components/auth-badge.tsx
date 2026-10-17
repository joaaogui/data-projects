"use client";

import { useEffect, useState } from "react";

/** Shows a login link while the browser has no session (writes would get 401). */
export function AuthBadge() {
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { configured?: boolean; authenticated?: boolean } | null) => {
        setNeedsLogin(Boolean(data?.configured && !data.authenticated));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!needsLogin) return null;
  return (
    <a
      href="/login?next=/"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 z-40 rounded-full border border-amber-400/40 bg-slate-900/95 px-3 py-1.5 text-xs font-medium text-amber-200 shadow-lg hover:bg-slate-800"
    >
      Entrar para salvar e perguntar
    </a>
  );
}
