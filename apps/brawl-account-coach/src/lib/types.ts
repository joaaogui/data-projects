export interface NamedItem {
  id: number;
  name: string;
}

export interface OwnedGear extends NamedItem {
  level?: number;
}

export interface PlayerBrawler {
  id: number;
  name: string;
  power: number;
  rank: number;
  trophies: number;
  highestTrophies: number;
  currentWinStreak?: number;
  maxWinStreak?: number;
  gadgets: NamedItem[];
  starPowers: NamedItem[];
  gears: OwnedGear[];
  hyperCharges: NamedItem[];
}

export interface PlayerProfile {
  tag: string;
  name: string;
  nameColor?: string;
  icon?: {
    id: number;
  };
  trophies: number;
  highestTrophies: number;
  expLevel: number;
  expPoints?: number;
  "3vs3Victories": number;
  soloVictories: number;
  duoVictories: number;
  club?: {
    tag: string;
    name: string;
  };
  brawlers: PlayerBrawler[];
}

export interface BrawlerCatalogItem {
  id: number;
  name: string;
  gadgets: NamedItem[];
  starPowers: NamedItem[];
  gears: NamedItem[];
  hyperCharges: NamedItem[];
}

export interface BrawlerCatalog {
  items: BrawlerCatalogItem[];
}

export interface BattleBrawler {
  id: number;
  name: string;
  power: number;
  trophies: number;
}

export interface BattlePlayer {
  tag: string;
  name: string;
  brawler: BattleBrawler;
}

export interface BattleEntry {
  battleTime: string;
  event: {
    id: number;
    mode: string;
    map: string;
  };
  battle: {
    mode: string;
    type: string;
    result?: string;
    duration?: number;
    trophyChange?: number;
    rank?: number;
    teams?: BattlePlayer[][];
    players?: BattlePlayer[];
    starPlayer?: BattlePlayer;
  };
}

export interface BattleLog {
  items: BattleEntry[];
}

export interface RosterCompletion {
  owned: number;
  total: number;
  percentage: number;
}

export interface PowerDistributionEntry {
  power: number;
  count: number;
  percentage: number;
}

export interface TrophyEfficiency {
  currentTotal: number;
  peakTotal: number;
  peakRetentionPercentage: number;
  averageTrophies: number;
  medianTrophies: number;
}

export interface PushCandidate {
  id: number;
  name: string;
  power: number;
  trophies: number;
  highestTrophies: number;
  gapToPeak: number;
  portraitUrl: string;
}

export type BattleOutcome = "victory" | "defeat" | "draw";

export interface RecentBattleSummary {
  battleTime: string;
  mode: string;
  map: string;
  brawlerName: string;
  result: BattleOutcome;
  trophyChange: number;
}

export interface ModeTrend {
  mode: string;
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  netTrophies: number;
}

export interface RecentTrend extends Omit<ModeTrend, "mode"> {
  byMode: ModeTrend[];
}

export interface AccountMetrics {
  rosterCompletion: RosterCompletion;
  powerDistribution: PowerDistributionEntry[];
  trophyEfficiency: TrophyEfficiency;
  underPushedBrawlers: PushCandidate[];
  recentBattles: RecentBattleSummary[];
  recentTrend: RecentTrend;
}

export interface AnalysisContext {
  player: PlayerProfile;
  battleLog: BattleLog;
  catalog: BrawlerCatalogItem[];
  metrics: AccountMetrics;
}

export interface AnalysisResponse {
  analysis: import("./schemas").AccountCoachAnalysis;
  player: PlayerProfile;
  metrics: AccountMetrics;
  generatedAt: string;
}
