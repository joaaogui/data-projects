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

export interface AnalysisContext {
  player: Player;
  recentLosses: RecentLoss[];
  metaDecks: MetaDeckReference[];
  metaAvailable: boolean;
}

export interface AnalysisResponse {
  analysis: import("./schemas").DeckAnalysis;
  player: Player;
  levelWarnings: LevelWarning[];
  generatedAt: string;
  metaAvailable: boolean;
  mode: import("./engine-context").AnalysisMode;
}
