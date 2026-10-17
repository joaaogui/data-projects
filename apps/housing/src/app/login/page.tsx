import { sanitizeNextPath } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar" };

const ERROR_COPY: Record<string, string> = {
  "1": "Token inválido.",
  unconfigured: "Autenticação não configurada no servidor (HOUSING_AUTH_TOKEN).",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const errorKey = typeof params.error === "string" ? params.error : null;

  return (
    <div className="mx-auto my-16 max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900/90 p-6 text-slate-100 shadow-xl">
      <h1 className="mb-1 text-lg font-semibold text-white">Entrar no Housing</h1>
      <p className="mb-5 text-sm text-slate-400">
        Necessário para perguntas, favoritos, filtros salvos e atualização de anúncios.
      </p>
      <form method="post" action="/api/auth/login" className="flex flex-col gap-3">
        <input type="hidden" name="next" value={nextPath} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Token de acesso</span>
          <input
            type="password"
            name="token"
            required
            autoComplete="current-password"
            autoFocus
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </label>
        {errorKey && (
          <p role="alert" className="text-sm text-rose-400">
            {ERROR_COPY[errorKey] ?? "Não foi possível entrar."}
          </p>
        )}
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
