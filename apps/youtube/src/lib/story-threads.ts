/**
 * Story threads: runs of nearby uploads whose titles share distinctive words,
 * for channels that continue a storyline across videos without playlists or
 * episode numbers. Pure and deterministic; titles are the only signal.
 */

export interface StoryVideo {
  videoId: string;
  title: string;
  /** Epoch ms; non-finite values are ignored. */
  time: number;
}

export interface StoryThread {
  /** Chronological (oldest first); at least `minSize` videos. */
  videoIds: string[];
  name: string;
}

export interface StoryParams {
  /** Below this many dated videos word frequencies mean nothing: no threads. */
  minCorpus: number;
  /** Words in more than this share of the channel's titles carry no weight. */
  boilerplate: number;
  /** A video links only to earlier candidates at most this many days back... */
  windowDays: number;
  /** ...and at most this many candidate uploads back. */
  maxBack: number;
  /** Minimum IDF-weighted Dice overlap of two titles. */
  minScore: number;
  /** A link is strong with this many shared distinctive words... */
  minShared: number;
  /** ...or with one shared word in at most this share of titles. */
  rareShare: number;
  /**
   * One shared word in at most this share of titles is a weak link: it only
   * extends a thread that has a strong link, and merges threads that overlap in time.
   */
  attachShare: number;
  /** Threads with fewer linked videos are dropped. */
  minSize: number;
  /** Up to this many unlinked uploads between two consecutive members join the thread. */
  bridge: number;
}

export const STORY_PARAMS: Readonly<StoryParams> = {
  minCorpus: 40,
  boilerplate: 0.08,
  windowDays: 4,
  maxBack: 12,
  minScore: 0.15,
  minShared: 2,
  rareShare: 0.005,
  attachShare: 0.02,
  minSize: 2,
  bridge: 1,
};

const DAY_MS = 86_400_000;
const STEM_LENGTH = 5;
const STOPWORDS = new Set(
  (
    // Portuguese
    "que das dos nos nas uma uns umas para pra pro pros pras por pelo pela pelos pelas com sem aos " +
    "esta este esse essa isso isto aquele aquela aquilo nao sim foi era sao ser ter tem tinha mais mas " +
    "muito muita muitos muitas ate sobre depois antes agora ainda tambem tudo nada ele ela eles elas " +
    "voce voces meu minha meus minhas seu sua seus suas nosso nossa quem qual quais quando onde como " +
    "porque aqui ali nem vai vou vem todo toda todos todas entao assim cade num numa dela dele " +
    // English
    "the and for with you your are was were this that these those what why how when who whom which " +
    "not but from have has had its into out about than then there they them their our all can will " +
    "just does did doesn don any some more most very also over under after before"
  ).split(" ")
);
const LAUGH_RE = /^(?:k{3,}|(?:ha){2,}h?|(?:he){2,}|(?:rs){2,})$/;
/** Plural / gender endings (accent-folded), first match wins; then one final a/e/o goes. */
const SUFFIXES: [string, string][] = [
  ["coes", "c"],
  ["cao", "c"],
  ["oes", "o"],
  ["aes", "a"],
  ["ais", "a"],
  ["eis", "e"],
  ["ois", "o"],
  ["al", "a"],
  ["ns", "m"],
  ["es", ""],
  ["s", ""],
];

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** "policiais"/"polícia" -> "polic", "presos"/"presa" -> "pres", "assinou"/"assine" -> "assin". */
function stem(folded: string): string {
  let s = folded;
  for (const [suf, rep] of SUFFIXES) {
    if (s.endsWith(suf) && s.length - suf.length + rep.length >= 3) {
      s = s.slice(0, s.length - suf.length) + rep;
      break;
    }
  }
  if (s.length > 3 && /[aeo]$/.test(s)) s = s.slice(0, -1);
  return s.slice(0, STEM_LENGTH);
}

/** Content words of a title as [original word, stem]; stopwords, numbers, laughs and short words dropped. */
export function titleWords(title: string): [string, string][] {
  const out: [string, string][] = [];
  const text = title.normalize("NFC").replace(/(?<=\p{L})@/gu, "a"); // "MERD@" -> "MERDA"
  for (const word of text.split(/[^\p{L}\p{N}]+/u)) {
    const f = fold(word);
    if (f.length < 3 || /^\d+$/.test(f) || STOPWORDS.has(f) || LAUGH_RE.test(f)) continue;
    out.push([word, stem(f)]);
  }
  return out;
}

interface Doc {
  id: string;
  time: number;
  /** Distinct stems. */
  words: string[];
  /** Stem -> first original word, for naming. */
  surface: Map<string, string>;
}

function toDoc(v: StoryVideo): Doc {
  const surface = new Map<string, string>();
  for (const [word, s] of titleWords(v.title)) if (!surface.has(s)) surface.set(s, word);
  return { id: v.videoId, time: v.time, words: [...surface.keys()], surface };
}

class DisjointSet {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) i = this.parent[i] = this.parent[this.parent[i]];
    return i;
  }
  union(a: number, b: number) {
    const [ra, rb] = [this.find(a), this.find(b)];
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

/**
 * Finds story threads among `videos` (chronological, oldest first) that are
 * not in `claimed`. Every dated video, claimed or not, counts toward the
 * channel's word frequencies so boilerplate is measured on the whole catalog.
 */
export function findStoryThreads(
  videos: readonly StoryVideo[],
  claimed: ReadonlySet<string>,
  params: Readonly<StoryParams> = STORY_PARAMS
): StoryThread[] {
  const docs = videos.filter((v) => Number.isFinite(v.time)).map(toDoc);
  const n = docs.length;
  if (n < params.minCorpus) return [];

  const df = new Map<string, number>();
  for (const d of docs) for (const w of d.words) df.set(w, (df.get(w) ?? 0) + 1);
  const weight = new Map<string, number>();
  for (const [w, c] of df) if (c >= 2 && c <= params.boilerplate * n) weight.set(w, Math.log(n / c));
  const rareDf = Math.max(2, params.rareShare * n);
  const attachDf = Math.max(2, params.attachShare * n);

  const cands = docs.filter((d) => !claimed.has(d.id));
  const feats = cands.map((d) => {
    const words = d.words.filter((w) => weight.has(w));
    return { words, set: new Set(words), mass: words.reduce((m, w) => m + weight.get(w)!, 0) };
  });
  const inWindow = (i: number, j: number) =>
    i - j <= params.maxBack && cands[i].time - cands[j].time <= params.windowDays * DAY_MS;
  /** [weighted Dice, strong?]; score -1 when the pair shares too little to link. */
  const similarity = (i: number, j: number): [number, boolean] => {
    const [a, b] = [feats[i], feats[j]];
    let shared = 0;
    let rarest = Infinity;
    let common = 0;
    for (const w of a.words) {
      if (!b.set.has(w)) continue;
      shared++;
      common += weight.get(w)!;
      rarest = Math.min(rarest, df.get(w)!);
    }
    const strong = shared >= params.minShared || rarest <= rareDf;
    if (!strong && rarest > attachDf) return [-1, false];
    return [(2 * common) / (a.mass + b.mass), strong];
  };

  // Each video links to its single best earlier match in the window.
  const sets = new DisjointSet(cands.length);
  const linked = new Set<number>();
  const strong = new Set<number>();
  for (let i = 1; i < cands.length; i++) {
    if (feats[i].words.length === 0) continue;
    let best = -1;
    let bestScore = 0;
    let bestStrong = false;
    for (let j = i - 1; j >= 0 && inWindow(i, j); j--) {
      const [score, isStrong] = similarity(i, j);
      if (score >= params.minScore && score > bestScore) [best, bestScore, bestStrong] = [j, score, isStrong];
    }
    if (best < 0) continue;
    sets.union(i, best);
    linked.add(i).add(best);
    if (bestStrong) strong.add(i);
  }

  // Threads that overlap in time and share an attachable word are one storyline told in alternation.
  const span = new Map<number, [number, number]>();
  for (const i of linked) {
    const r = sets.find(i);
    const s = span.get(r);
    span.set(r, s ? [Math.min(s[0], i), Math.max(s[1], i)] : [i, i]);
  }
  const rootOf = new Map([...linked].map((i) => [i, sets.find(i)]));
  for (const i of [...linked].sort((x, y) => x - y)) {
    const si = span.get(rootOf.get(i)!)!;
    for (let j = i - 1; j >= 0 && inWindow(i, j); j--) {
      const rj = rootOf.get(j);
      if (rj === undefined || sets.find(i) === sets.find(j)) continue;
      const sj = span.get(rj)!;
      if (si[0] > sj[1] || sj[0] > si[1]) continue;
      if (feats[i].words.some((w) => feats[j].set.has(w) && df.get(w)! <= attachDf)) sets.union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (const i of [...linked].sort((x, y) => x - y)) {
    const r = sets.find(i);
    const g = groups.get(r);
    if (g) g.push(i);
    else groups.set(r, [i]);
  }
  const threads = [...groups.values()].filter(
    (g) => g.length >= params.minSize && g.some((i) => strong.has(i))
  );
  const taken = new Set(threads.flat());
  for (const g of threads) {
    const gaps: number[] = [];
    for (let k = 1; k < g.length; k++) {
      if (g[k] - g[k - 1] - 1 > params.bridge) continue;
      for (let m = g[k - 1] + 1; m < g[k]; m++) if (!taken.has(m)) gaps.push(m);
    }
    gaps.forEach((m) => taken.add(m));
    g.push(...gaps);
    g.sort((x, y) => x - y);
  }
  threads.sort((x, y) => x[0] - y[0]);

  return threads.map((g) => {
    const members = g.map((i) => cands[i]);
    return { videoIds: members.map((d) => d.id), name: nameThread(members, weight) };
  });
}

const titleCase = (w: string) => w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1).toLocaleLowerCase("pt-BR");

/** Up to 3 words in 2+ members, ranked by members x IDF, in their first original spelling. */
function nameThread(members: readonly Doc[], weight: ReadonlyMap<string, number>): string {
  const count = new Map<string, number>();
  const surface = new Map<string, string>();
  for (const d of members) {
    for (const w of d.words) {
      if (!weight.has(w)) continue;
      count.set(w, (count.get(w) ?? 0) + 1);
      if (!surface.has(w)) surface.set(w, d.surface.get(w)!);
    }
  }
  const ranked = [...count]
    .filter(([, c]) => c >= 2)
    .map(([w, c]) => ({ w, score: c * weight.get(w)! }))
    .sort((a, b) => b.score - a.score || (a.w < b.w ? -1 : 1))
    .slice(0, 3);
  return ranked.map(({ w }) => titleCase(surface.get(w)!)).join(" · ") || "Story";
}
