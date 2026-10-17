"use client";

import { useEffect } from "react";

export default function HousingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[HousingErrorBoundary]", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto my-12 flex max-w-lg flex-col items-center justify-center rounded-2xl border border-rose-500/30 bg-slate-900/90 p-8 text-center text-slate-100 shadow-xl"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
        <span className="text-xl font-bold">!</span>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-white">
        Ocorreu um erro inesperado ao renderizar o portal
      </h2>
      <p className="mb-6 text-sm text-slate-300">
        {error?.message
          ? `Detalhe técnico: ${error.message}`
          : "Um dado inválido ou falha temporária interrompeu a visualização."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          Tentar novamente
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}
