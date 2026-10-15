import {
  ArrowRight,
  ChevronDown,
  Clock,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  MIN_BATTLES_FOR_VERDICT,
  parseClashBattleTime,
} from "@/lib/learning-engine";
import type {
  BattleHistoryStats,
  DeckChangeImpact,
  DeckVersionSummary,
} from "@/lib/types";

interface LastChangeCardProps {
  changeImpacts: DeckChangeImpact[];
  deckVersions: DeckVersionSummary[];
  historyStats: BattleHistoryStats;
  avoidedCards: string[];
  onClearHistory: () => void;
}

const VERDICTS = {
  helped: {
    title: "Yes, it helped",
    className: "bg-[#e8f6f0] text-[#087454]",
    Icon: TrendingUp,
  },
  hurt: {
    title: "No, it hurt",
    className: "bg-[#fff0ef] text-[#b42318]",
    Icon: TrendingDown,
  },
  testing: {
    title: "Still testing",
    className: "bg-[#fff5d6] text-[#76530a]",
    Icon: Clock,
  },
  even: {
    title: "Too close to call",
    className: "bg-[#eef1f5] text-[#33445c]",
    Icon: Scale,
  },
} as const;

const SOURCE_TEXT: Record<DeckChangeImpact["source"], string> = {
  "advisor-full": "You followed the advisor's suggestion.",
  "advisor-partial": "You took part of the advisor's suggestion.",
  "player-custom": "This was your own change.",
  "battle-log-transition": "Spotted in your battle log.",
};

const percent = (value: number) => `${value.toFixed(0)}%`;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function verdictFor(impact: DeckChangeImpact): {
  key: keyof typeof VERDICTS;
  detail: string;
} {
  const before = percent(impact.beforeWinRate);
  const after = percent(impact.afterWinRate);
  if (impact.verdict === "helped") {
    return { key: "helped", detail: `Win rate went from ${before} to ${after}.` };
  }
  if (impact.verdict === "hurt") {
    return { key: "hurt", detail: `Win rate fell from ${before} to ${after}.` };
  }
  const remaining = MIN_BATTLES_FOR_VERDICT - impact.afterBattles;
  if (remaining > 0) {
    return {
      key: "testing",
      detail:
        impact.afterBattles === 0
          ? `Play ${plural(MIN_BATTLES_FOR_VERDICT, "battle")} with it to find out.`
          : `Play ${plural(remaining, "more battle")} with it for a verdict.`,
    };
  }
  return {
    key: "even",
    detail: `Win rate moved from ${before} to ${after}, not enough to call.`,
  };
}

function SwapPills({ swaps }: { swaps: DeckChangeImpact["swaps"] }) {
  return (
    <ul aria-label="Cards changed" className="flex flex-wrap gap-2">
      {swaps.map((swap) => (
        <li
          key={`${swap.out}-${swap.in}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f5fa] px-3 py-1.5 text-sm font-bold"
        >
          <span className="text-[#9b2c24]">{swap.out}</span>
          <ArrowRight aria-hidden="true" className="size-3.5 text-[#6d7a8b]" />
          <span className="sr-only">replaced by</span>
          <span className="text-[#087454]">{swap.in}</span>
        </li>
      ))}
    </ul>
  );
}

function HistoryDisclosure({
  olderImpacts,
  deckVersions,
  historyStats,
  onClearHistory,
}: {
  olderImpacts: DeckChangeImpact[];
  deckVersions: DeckVersionSummary[];
  historyStats: BattleHistoryStats;
  onClearHistory: () => void;
}) {
  const shownVersions = deckVersions.slice(0, 8);
  const oldestMs = historyStats.oldestBattleTime
    ? parseClashBattleTime(historyStats.oldestBattleTime)
    : 0;
  const since =
    oldestMs > 0
      ? new Date(oldestMs).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <details className="disclosure group mt-5 border-t border-[#e2e7ee]">
      <summary className="royal-focus flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg pt-3 text-sm font-extrabold text-[#0b1f3a]">
        History
        <span className="flex items-center gap-2 text-xs font-bold text-[#5c6b7f]">
          {plural(deckVersions.length, "deck version")}
          <ChevronDown
            aria-hidden="true"
            className="size-4 motion-safe:transition-transform group-open:rotate-180"
          />
        </span>
      </summary>

      <div className="space-y-6 pt-4">
        {olderImpacts.length > 0 ? (
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#5c6b7f]">
              Earlier changes
            </h3>
            <ul className="mt-2 divide-y divide-[#eef1f5]">
              {olderImpacts.map((impact) => (
                <li
                  key={`${impact.fromVersionLabel}-${impact.toVersionLabel}`}
                  className="py-3"
                >
                  <SwapPills swaps={impact.swaps} />
                  <p className="mt-2 text-xs font-bold text-[#5c6b7f]">
                    {impact.toVersionLabel}: {VERDICTS[verdictFor(impact).key].title}
                    {impact.afterBattles > 0
                      ? ` · ${percent(impact.beforeWinRate)} → ${percent(impact.afterWinRate)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#5c6b7f]">
            Deck versions
          </h3>
          <ul className="mt-2 divide-y divide-[#eef1f5]">
            {shownVersions.map((version) => (
              <li key={version.deckKey} className="py-3">
                <p className="text-sm font-extrabold text-[#0b1f3a]">
                  {version.versionLabel}
                  {version.isCurrentActiveDeck ? " · current deck" : ""}
                  <span className="ml-2 font-bold text-[#5c6b7f]">
                    {version.battles > 0
                      ? `${version.wins}W–${version.losses}L · ${percent(version.winRate)}`
                      : "not played yet"}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-5 text-[#5c6b7f]">
                  {version.cards.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
          {deckVersions.length > shownVersions.length ? (
            <p className="mt-1 text-xs text-[#6d7a8b]">
              +{deckVersions.length - shownVersions.length} older versions
            </p>
          ) : null}
        </div>

        <div className="rounded-xl bg-[#f5f8ff] p-4 text-xs leading-5 text-[#33445c]">
          <p>
            Clash Royale only shares your last 25 or so battles per fetch.{" "}
            {historyStats.fromBrowser > 0
              ? `Saved history adds ${plural(historyStats.fromBrowser, "older battle")}, so these numbers cover ${plural(historyStats.battlesTracked, "battle")}${since ? ` since ${since}` : ""}.`
              : `Every check-in saves new battles to the advisor database (${plural(historyStats.battlesTracked, "battle")} tracked so far).`}
          </p>
          <button
            type="button"
            onClick={onClearHistory}
            className="royal-focus mt-3 inline-flex min-h-11 items-center rounded-xl border border-[#d9e1ec] bg-white px-4 text-sm font-extrabold text-[#33445c] transition-colors hover:border-[#b42318] hover:text-[#b42318]"
          >
            Clear browser cache
          </button>
        </div>
      </div>
    </details>
  );
}

export function LastChangeCard({
  changeImpacts,
  deckVersions,
  historyStats,
  avoidedCards,
  onClearHistory,
}: LastChangeCardProps) {
  const [latest, ...older] = changeImpacts;
  const verdict = latest ? verdictFor(latest) : null;
  const badge = verdict ? VERDICTS[verdict.key] : null;

  return (
    <section
      aria-labelledby="last-change-title"
      className="paper-panel rounded-2xl p-5 sm:p-6"
    >
      <h2
        id="last-change-title"
        className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
      >
        Did your last change work?
      </h2>

      {latest && verdict && badge ? (
        <div className="mt-4 space-y-4">
          <p
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold ${badge.className}`}
          >
            <badge.Icon aria-hidden="true" className="size-4" />
            {badge.title}
          </p>

          <SwapPills swaps={latest.swaps} />

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#f5f8ff] px-4 py-3">
              <dt className="text-xs font-bold text-[#5c6b7f]">
                Before
                {latest.fromVersionLabel === "Baseline"
                  ? ""
                  : ` · ${plural(latest.beforeBattles, "battle")}`}
              </dt>
              <dd className="mt-0.5 text-2xl font-extrabold tabular-nums">
                {percent(latest.beforeWinRate)}
              </dd>
            </div>
            <div className="rounded-xl bg-[#f5f8ff] px-4 py-3">
              <dt className="text-xs font-bold text-[#5c6b7f]">
                After · {plural(latest.afterBattles, "battle")}
              </dt>
              <dd className="mt-0.5 text-2xl font-extrabold tabular-nums">
                {latest.afterBattles > 0 ? percent(latest.afterWinRate) : "—"}
              </dd>
            </div>
          </dl>

          <p className="text-sm leading-6 text-[#33445c]">
            {verdict.detail}
            {verdict.key === "hurt" && avoidedCards.length > 0
              ? ` The advisor is steering away from ${avoidedCards.join(", ")}.`
              : ""}
            <span className="mt-1 block text-xs text-[#6d7a8b]">
              {SOURCE_TEXT[latest.source]}
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#5c6b7f]">
          No deck change spotted yet. Swap a card, play a few battles, and the
          result shows up here.
        </p>
      )}

      <HistoryDisclosure
        olderImpacts={older}
        deckVersions={deckVersions}
        historyStats={historyStats}
        onClearHistory={onClearHistory}
      />
    </section>
  );
}
