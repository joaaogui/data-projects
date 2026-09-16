/**
 * Curated meta reference, September 2026.
 *
 * Live top-ladder decks are the preferred evidence, but both ranking feeds can
 * return nothing. This table keeps the model grounded in the real meta instead
 * of leaving it to guess from training data of unknown vintage.
 *
 * Sources: Supercell September 2026 balance notes, plus aggregated ladder
 * win-rate reporting for the same patch.
 */

export interface MetaArchetype {
  name: string;
  tier: "S" | "A" | "B";
  coreCards: string[];
  summary: string;
}

export const META_LAST_REVIEWED = "2026-09";

export const META_ARCHETYPES: MetaArchetype[] = [
  {
    name: "Hog Cycle",
    tier: "S",
    coreCards: [
      "Hog Rider",
      "Musketeer",
      "Ice Golem",
      "Cannon",
      "Skeletons",
      "Ice Spirit",
      "The Log",
      "Fireball",
    ],
    summary:
      "Most-played archetype above 6000 trophies. Cheap, forgiving, and unaffected by the Spirit nerfs.",
  },
  {
    name: "Goblin Barrel Bait",
    tier: "S",
    coreCards: [
      "Goblin Barrel",
      "Princess",
      "Goblin Gang",
      "Knight",
      "Inferno Tower",
      "Rocket",
      "The Log",
      "Ice Spirit",
    ],
    summary:
      "Top two archetype from 5000 trophies up. Baits small spells then punishes with Barrel.",
  },
  {
    name: "Evolution Elite Barbarians",
    tier: "S",
    coreCards: ["Elite Barbarians", "Royal Hogs", "Fireball", "Zap"],
    summary:
      "Highest mid-ladder win rate, though the September spear range and Rage nerfs reduced its dominance.",
  },
  {
    name: "Miner Poison Control",
    tier: "A",
    coreCards: ["Miner", "Poison", "Bats", "Valkyrie", "Musketeer", "The Log"],
    summary:
      "Chip control that gained value as spell-cycle finishes weakened this patch.",
  },
  {
    name: "Mega Knight Bait",
    tier: "A",
    coreCards: [
      "Mega Knight",
      "Goblin Barrel",
      "Princess",
      "Goblin Gang",
      "Zap",
    ],
    summary: "Strong mid-ladder shell built around splash defense and bait.",
  },
  {
    name: "Golem or Electro Giant Beatdown",
    tier: "A",
    coreCards: [
      "Golem",
      "Night Witch",
      "Baby Dragon",
      "Lightning",
      "Electro Giant",
      "Tornado",
    ],
    summary:
      "Double-elixir beatdown, largely untouched by the September balance pass.",
  },
  {
    name: "Royal Hogs",
    tier: "B",
    coreCards: ["Royal Hogs", "Firecracker", "Ice Golem", "Fireball"],
    summary:
      "Effective around 5000-6000 trophies but drops below a 50 percent win rate higher up.",
  },
  {
    name: "P.E.K.K.A Bridge Spam",
    tier: "B",
    coreCards: [
      "P.E.K.K.A",
      "Bandit",
      "Royal Ghost",
      "Magic Archer",
      "Poison",
      "Zap",
    ],
    summary:
      "Punish archetype that converts a defended P.E.K.K.A into a counter-push.",
  },
];

/**
 * September 2026 balance notes that change how cards should be valued.
 */
export const META_BALANCE_NOTES: string[] = [
  "Fireball was nerfed as a tower finisher but still clears support troops, so plan win conditions around troop damage rather than spell chip.",
  "Freeze was nerfed, making all-in Freeze finishes slower and less reliable.",
  "Base Wizard received a damage buff and now one-shots Firecracker and Archers.",
  "Evolved Elite Barbarians and Evolved Battle Ram were nerfed but remain playable.",
];
