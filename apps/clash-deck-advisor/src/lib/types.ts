export interface CardIconUrls {
  medium: string;
  evolutionMedium?: string;
  /** Present when the card has a Hero form in game, not when one is unlocked. */
  heroMedium?: string;
}

export interface ClashCard {
  id: number;
  name: string;
  level: number;
  maxLevel: number;
  maxEvolutionLevel?: number;
  evolutionLevel?: number;
  starLevel?: number;
  elixirCost?: number;
  rarity: string;
  iconUrls: CardIconUrls;
}

export interface Arena {
  id: number;
  name: string;
}

export interface Player {
  tag: string;
  name: string;
  expLevel?: number;
  trophies: number;
  bestTrophies?: number;
  wins: number;
  losses: number;
  battleCount: number;
  arena: Arena;
  currentDeck: ClashCard[];
  cards: ClashCard[];
}

export interface BattleParticipant {
  tag: string;
  name: string;
  crowns: number;
  trophyChange?: number;
  cards: ClashCard[];
}

export interface Battle {
  type: string;
  battleTime: string;
  arena?: Arena;
  gameMode?: {
    id: number;
    name: string;
  };
  team: BattleParticipant[];
  opponent: BattleParticipant[];
}

export interface RecentLoss {
  battleTime: string;
  opponentName: string;
  opponentCrowns: number;
  playerCrowns: number;
  opponentDeck: string[];
}

export interface MetaDeckReference {
  playerTag: string;
  playerName: string;
  /** Trophies on the legacy feed, Elo on the Path of Legend feed. */
  rating: number;
  deck: string[];
}

export interface LevelWarning {
  cardName: string;
  severity: "high" | "medium" | "low";
  message: string;
}

export type BattleOutcome = "win" | "loss" | "draw";

export interface NormalizedBattle {
  battleTime: string;
  timestampMs: number;
  type: string;
  gameModeName: string;
  isLadderOrRanked: boolean;
  outcome: BattleOutcome;
  playerCrowns: number;
  opponentCrowns: number;
  crownDiff: number;
  trophyChange: number;
  playerDeck: string[];
  deckKey: string;
  opponentName: string;
  opponentTag: string;
  opponentDeck: string[];
  opponentArchetype: string;
}

export type ThreatCategory =
  | "heavyTank"
  | "fastCycleWinCon"
  | "spellBait"
  | "airBeatdown"
  | "splashSupport"
  | "buildingSiege"
  | "other";

export interface ThreatCardStat {
  cardName: string;
  lossesAgainst: number;
  winsAgainst: number;
  totalSeen: number;
  lossRateAgainst: number;
  threatCategory: ThreatCategory;
  recommendedCounters: string[];
}

export interface BlindSpotDiagnostic {
  category: ThreatCardStat["threatCategory"];
  label: string;
  severity: "high" | "medium" | "low";
  evidence: string;
  neededRole: string;
  counterCards: string[];
}

export interface LossAutopsy {
  totalBattlesAnalyzed: number;
  recentWins: number;
  recentLosses: number;
  recentDraws: number;
  recentWinRate: number;
  netTrophies: number;
  currentStreak: { type: "win" | "loss" | "none"; count: number };
  threeCrownLosses: number;
  oneCrownLosses: number;
  topThreatCards: ThreatCardStat[];
  topThreatArchetypes: {
    archetype: string;
    losses: number;
    wins: number;
    lossRate: number;
  }[];
  dominantBlindSpots: BlindSpotDiagnostic[];
}

export interface DeckVersionSummary {
  deckKey: string;
  versionLabel: string;
  cards: string[];
  isCurrentActiveDeck: boolean;
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  netTrophies: number;
  avgCrownDiff: number;
  firstSeen: string;
  lastSeen: string;
  swapsFromPrevious: { out: string; in: string }[];
  swapsToCurrent: { out: string; in: string }[];
  topLossesAgainst: string[];
  verdict: "working" | "underperforming" | "testing" | "untested";
}

export interface DeckChangeImpact {
  fromVersionLabel: string;
  toVersionLabel: string;
  fromDeck: string[];
  toDeck: string[];
  swaps: { out: string; in: string }[];
  source:
    | "advisor-full"
    | "advisor-partial"
    | "player-custom"
    | "battle-log-transition";
  matchedSuggestionId?: string;
  beforeBattles: number;
  beforeWinRate: number;
  afterBattles: number;
  afterWinRate: number;
  winRateDelta: number;
  trophyDelta: number;
  verdict: "helped" | "hurt" | "inconclusive" | "pending";
  summary: string;
}

export interface StoredSuggestionEntry {
  id: string;
  createdAt: string;
  mode: import("./engine-context").AnalysisMode;
  baselineDeck: string[];
  baselineWinRate: number;
  recommendedDeck: string[];
  recommendedSwaps: { out: string; in: string }[];
  archetypeName: string;
}

export interface PlayerFeedbackInput {
  lockedCards: string[];
  excludedCards: string[];
  suggestionHistory: StoredSuggestionEntry[];
}

export interface AppliedFeedback {
  lockedCards: string[];
  excludedCards: string[];
  penalizedDecks: string[];
}

export interface AnalysisContext {
  player: Player;
  recentLosses: RecentLoss[];
  metaDecks: MetaDeckReference[];
  metaAvailable: boolean;
  normalizedBattles?: NormalizedBattle[];
  lossAutopsy: LossAutopsy;
  deckVersions: DeckVersionSummary[];
  changeImpacts: DeckChangeImpact[];
}

export interface AnalysisResponse {
  analysis: import("./schemas").DeckAnalysis;
  player: Player;
  levelWarnings: LevelWarning[];
  generatedAt: string;
  metaAvailable: boolean;
  mode: import("./engine-context").AnalysisMode;
  lossAutopsy: LossAutopsy;
  deckVersions: DeckVersionSummary[];
  changeImpacts: DeckChangeImpact[];
  appliedFeedback: AppliedFeedback;
}
