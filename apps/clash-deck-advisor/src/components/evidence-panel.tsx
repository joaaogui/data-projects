import type { DeckEvidence } from "@/lib/schemas";

export function EvidencePanel({ evidence }: { evidence: DeckEvidence }) {
  return (
    <section
      aria-labelledby="evidence-title"
      className="paper-panel rounded-[1.35rem] p-5 sm:p-7"
    >
      <p className="text-sm font-bold text-[#164fc9]">Why this deck</p>
      <h2
        id="evidence-title"
        className="font-display mt-1 text-3xl font-semibold tracking-[-0.035em]"
      >
        {evidence.archetypeName}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5c6b7f]">
        {evidence.source}
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-bold text-[#6d7a8b]">Confidence</dt>
          <dd className="mt-1 text-lg font-extrabold capitalize">
            {evidence.confidence}
          </dd>
          <p className="mt-1 text-xs leading-5 text-[#526175]">
            How sure the engine is. Cannot be high when zero live ladder decks
            share the core.
          </p>
        </div>
        <div>
          <dt className="text-xs font-bold text-[#6d7a8b]">Level readiness</dt>
          <dd className="mt-1 text-lg font-extrabold tabular-nums">
            {evidence.levelReadiness}%
          </dd>
          <p className="mt-1 text-xs leading-5 text-[#526175]">
            Share of recommended cards at or above this deck&apos;s median
            level — the same bar that triggers level warnings.
          </p>
        </div>
        <div>
          <dt className="text-xs font-bold text-[#6d7a8b]">
            Live decks with this core
          </dt>
          <dd className="mt-1 text-lg font-extrabold tabular-nums">
            {evidence.liveMetaOverlap}
          </dd>
          <p className="mt-1 text-xs leading-5 text-[#526175]">
            Count of checked top-ladder decks that share at least four signature
            cards.
          </p>
        </div>
      </dl>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-extrabold">What holds it together</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-[#33445c]">
            {evidence.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-extrabold">What it still loses to</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-[#5c6b7f]">
            {evidence.weaknesses.length === 0 ? (
              <li>No structural hole in this shell.</li>
            ) : (
              evidence.weaknesses.map((item) => <li key={item}>{item}</li>)
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
