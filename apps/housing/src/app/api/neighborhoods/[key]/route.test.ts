import { describe, expect, it } from "vitest";

import { GET } from "./route";

function call(key: string) {
  return GET(new Request(`http://localhost/api/neighborhoods/${key}`), {
    params: Promise.resolve({ key }),
  });
}

describe("GET /api/neighborhoods/[key]", () => {
  it("returns the dossier with a cacheable response", async () => {
    const res = await call(encodeURIComponent("BH:Lourdes"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("public");
    const json = (await res.json()) as { ok: boolean; dossier: { key: string; crime: { scope: string } } };
    expect(json.ok).toBe(true);
    expect(json.dossier.key).toBe("BH:Lourdes");
    expect(json.dossier.crime.scope).toBe("bairro (SEJUSP)");
  });

  it("resolves listing aliases", async () => {
    const res = await call(encodeURIComponent("CP:Jardim Guanabara"));
    const json = (await res.json()) as { dossier: { key: string } };
    expect(json.dossier.key).toBe("CP:Jd. Guanabara");
  });

  it("404s unknown neighbourhoods and 400s malformed keys", async () => {
    expect((await call(encodeURIComponent("SP:Pinheiros"))).status).toBe(404);
    expect((await call("semcidade")).status).toBe(400);
    expect((await call("%E0%A4%A")).status).toBe(400);
  });
});
