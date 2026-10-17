/**
 * Regenerates the golden ranking fixture in src/lib/__fixtures__.
 *
 *   pnpm exec tsx --conditions=react-server scripts/update-golden.ts            # expected outputs only
 *   pnpm exec tsx --conditions=react-server scripts/update-golden.ts --reselect # also re-pick listings from src/data
 *
 * Run from apps/housing. Without --reselect the committed listings are kept and only
 * golden-expected.json is rewritten (use after an intentional scoring change).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = join(process.cwd(), "src/lib/__fixtures__");
const LISTINGS_FILE = "golden-listings.json";
const EXPECTED_FILE = "golden-expected.json";

const golden = await import("../src/lib/__fixtures__/golden");
const NOW_MS = Date.parse(golden.GOLDEN_NOW);

const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args: ConstructorParameters<typeof Date>) {
    if (args.length === 0) super(NOW_MS);
    else super(...args);
  }
  static now() {
    return NOW_MS;
  }
}
globalThis.Date = FrozenDate as unknown as DateConstructor;

const PII_KEY = /advertiser|phone|whats|e-?mail|creci|contact|owner|broker/i;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE_CANDIDATE = /\+?\(?\d[\d\s().-]{8,}\d/g;
const SPACED_PHONE = /\(?\b\d{2}\)?[\s.-]*9?\d{4}[\s.-]\d{4}\b/g;
const CRECI = /\bCRECI\b[^\\,;)]*?\d[\w./-]*/gi;
const HANDLE = /@[\w.]{3,}/g;

function redactPhones(text: string): string {
  return text.replace(PHONE_CANDIDATE, (match) => {
    const digits = match.replace(/\D/g, "").length;
    const phoneShaped = /[()-]/.test(match) || /^\+?\d+$/.test(match);
    return digits >= 10 && digits <= 13 && phoneShaped ? "[telefone omitido]" : match;
  });
}

function stripPii<T>(value: T): T {
  if (typeof value === "string") {
    return redactPhones(value.replace(EMAIL, "[email omitido]"))
      .replace(SPACED_PHONE, "[telefone omitido]")
      .replace(CRECI, "CRECI [omitido]")
      .replace(HANDLE, "[perfil omitido]") as T;
  }
  if (Array.isArray(value)) return value.map(stripPii) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (PII_KEY.test(k)) continue;
      out[k] = k === "id" || k === "url" ? v : stripPii(v);
    }
    return out as T;
  }
  return value;
}

const sha = (s: string) => createHash("sha1").update(s).digest("hex");

async function reselect(): Promise<void> {
  const { loadServedListings } = await import("../src/lib/dataset-store");
  const { PHOTO_AUDIT_OVERRIDES } = await import("../src/lib/photo-audit-overrides");
  const { DEFAULT_WEIGHTS, computeDynamicNeighborhoods, precomputeListingFeatures, scorePrecomputedListings, AC_ABSENT_TAG, AC_UNCONFIRMED_TAG, AC_INFRA_ONLY_TAG, FURNITURE_CONFLICT_TAG, PRICE_MISMATCH_TAG, HOSPITAL_NOISE_TAG } =
    await import("../src/lib/scoring-engine");
  const { loadListingDeactivations } = await import("../src/lib/listing-deactivations");

  const served = await loadServedListings();
  const all = scorePrecomputedListings(
    precomputeListingFeatures(served.properties),
    computeDynamicNeighborhoods(served.neighborhoods, DEFAULT_WEIGHTS).ranked,
    DEFAULT_WEIGHTS,
    { includeBsbBenchmark: true },
  );
  const keyOf = (p: { provider: string; id: string }) => `${p.provider}:${p.id}`;
  const byHash = [...all].sort((a, b) => (sha(keyOf(a)) < sha(keyOf(b)) ? -1 : 1));
  const tagsOf = (p: (typeof all)[number]) =>
    [...p.cardTags.greenTags, ...p.cardTags.redTags, ...p.cardTags.warningTags, p.cardTags.acLabel ?? ""];
  const text = (p: (typeof all)[number]) => `${p.title ?? ""} ${p.description ?? ""}`;

  const picked = new Set<string>();
  const pick = (label: string, n: number, pred: (p: (typeof all)[number]) => boolean) => {
    const hits = byHash.filter(pred);
    hits.slice(0, n).forEach((p) => picked.add(keyOf(p)));
    console.log(`${label.padEnd(24)} ${Math.min(n, hits.length)}/${hits.length}`);
  };

  pick("top eligible", 25, (p) => p.eligible && p.overallRank !== null && p.overallRank <= 40);
  for (const city of ["SP", "RJ", "BH", "CP", "BSB"]) {
    pick(`city ${city} eligible`, 12, (p) => p.cityCode === city && p.eligible);
    pick(`city ${city} ineligible`, 8, (p) => p.cityCode === city && !p.eligible);
  }
  pick("AC confirmed", 6, (p) => p.cardTags.acLabel !== null);
  pick("AC unconfirmed", 6, (p) => tagsOf(p).includes(AC_UNCONFIRMED_TAG));
  pick("AC absent", 6, (p) => tagsOf(p).includes(AC_ABSENT_TAG));
  pick("AC infra only", 6, (p) => tagsOf(p).includes(AC_INFRA_ONLY_TAG));
  pick("parking none", 5, (p) => p.parkingSpaces < 1);
  pick("parking 2+", 4, (p) => p.parkingSpaces >= 2);
  pick("parking rotativa", 5, (p) => /vagas?\b[^.]{0,40}rotativ/i.test(text(p)));
  pick("parking presa/gaveta", 5, (p) => /\b(presas?|gavetas?)\b/i.test(text(p)));
  pick("parking demarcada/livre", 4, (p) => /vagas?\b[^.]{0,30}(demarcad|livre)/i.test(text(p)));
  for (const tier of ["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"]) {
    pick(`furniture ${tier}`, 5, (p) => p.furnitureTier === tier);
  }
  pick("furniture conflict", 5, (p) => tagsOf(p).includes(FURNITURE_CONFLICT_TAG));
  pick("loft/mezanino", 5, (p) => /\b(loft|mezanino)\b/i.test(text(p)));
  pick("duplex/triplex", 5, (p) => /\b(duplex|triplex)\b/i.test(text(p)));
  pick("cross-portal duplicate", 6, (p) => (p.alsoListedOn?.length ?? 0) > 0);
  pick("IPTU estimated", 6, (p) => p.listedIptu !== undefined && p.listedIptu !== null);
  pick("rent from description", 5, (p) => p.listedRent !== undefined && p.listedRent !== null);
  pick("price mismatch tag", 5, (p) => tagsOf(p).includes(PRICE_MISMATCH_TAG));
  pick("hospital noise", 3, (p) => tagsOf(p).includes(HOSPITAL_NOISE_TAG));
  pick("for sale", 3, (p) => p.salePrice !== null && p.salePrice > 0);
  pick("photo override", 14, (p) => keyOf(p) in PHOTO_AUDIT_OVERRIDES);
  pick("deactivated", 6, (p) => p.isActive === false);
  const deactivationKeys = new Set(Object.keys(loadListingDeactivations()));
  pick("deactivation file", 3, (p) => deactivationKeys.has(keyOf(p)));
  const reasons = new Map<string, string>();
  for (const p of byHash) {
    for (const reason of (p.exclusionReason ?? "").split(" · ")) {
      const head = reason.replace(/[\d.,]+/g, "#").slice(0, 40);
      if (reason && !reasons.has(head)) reasons.set(head, keyOf(p));
    }
  }
  reasons.forEach((key) => picked.add(key));
  console.log(`${"exclusion reasons".padEnd(24)} ${reasons.size}`);

  // Duplicates are only patched when every twin is scored together.
  const byKey = new Map(all.map((p) => [keyOf(p), p]));
  for (const key of [...picked]) {
    for (const twin of byKey.get(key)?.alsoListedOn ?? []) picked.add(twin);
  }

  const properties = served.properties
    .filter((p) => picked.has(keyOf(p)))
    .map((p) => stripPii({ ...p, samplePhotos: [] }));
  const dataset = { neighborhoods: stripPii(served.neighborhoods), properties };
  writeFileSync(join(FIXTURES_DIR, LISTINGS_FILE), `${JSON.stringify(dataset)}\n`);
  console.log(`selected ${properties.length} listings`);
}

if (process.argv.includes("--reselect")) await reselect();

const dataset = JSON.parse(
  readFileSync(join(FIXTURES_DIR, LISTINGS_FILE), "utf8"),
) as import("../src/lib/__fixtures__/golden").GoldenInput;
const expected = golden.computeGoldenRows(dataset);
writeFileSync(join(FIXTURES_DIR, EXPECTED_FILE), `${JSON.stringify(expected, null, 1)}\n`);
for (const [id, rows] of Object.entries(expected)) {
  console.log(`${id}: ${rows.length} rows, ${rows.filter((r) => r.eligible).length} eligible`);
}
