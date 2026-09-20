/**
 * Complete ladder shells, not role checklists.
 *
 * Each slot lists acceptable cards in preference order. A deck is only a
 * candidate when every slot can be filled from the player's own collection.
 */

export interface ArchetypeSlot {
  id: string;
  label: string;
  options: string[];
}

export interface ArchetypeTemplate {
  id: string;
  name: string;
  tier: "S" | "A" | "B";
  /** Relative weight from current ladder reporting. Live overlap adds to this. */
  support: number;
  summary: string;
  /** Cards that define the archetype and stay locked in Improve Current. */
  core: string[];
  primaryWinConditions: string[];
  slots: ArchetypeSlot[];
}

export const ARCHETYPE_TEMPLATES: ArchetypeTemplate[] = [
  {
    id: "royal-recruits-bait",
    name: "Royal Recruits Bait",
    tier: "S",
    support: 90,
    summary:
      "Split-lane bait: Recruits occupy one side while Wall Breakers and Skeleton Barrel punish the spell used on the other.",
    core: ["Royal Recruits", "Wall Breakers", "Skeleton Barrel"],
    primaryWinConditions: ["Wall Breakers", "Skeleton Barrel"],
    slots: [
      { id: "recruits", label: "split tank", options: ["Royal Recruits"] },
      { id: "breakers", label: "win condition", options: ["Wall Breakers"] },
      {
        id: "barrel",
        label: "second bait threat",
        options: ["Skeleton Barrel", "Goblin Barrel"],
      },
      {
        id: "swarm",
        label: "bait swarm",
        options: ["Goblin Gang", "Skeleton Army", "Guards"],
      },
      {
        id: "champion",
        label: "champion",
        options: ["Mighty Miner", "Golden Knight", "Skeleton King"],
      },
      {
        id: "air",
        label: "ranged air defense",
        options: ["Archers", "Minions", "Magic Archer", "Musketeer", "Princess"],
      },
      {
        id: "big-spell",
        label: "big spell",
        options: ["Fireball", "Poison"],
      },
      {
        id: "small-spell",
        label: "small spell",
        options: ["Royal Delivery", "Barbarian Barrel", "The Log", "Arrows"],
      },
    ],
  },
  {
    id: "graveyard-control",
    name: "Graveyard Control",
    tier: "A",
    support: 68,
    summary:
      "A tank or splash unit holds the tower while Graveyard chips it. Poison or Fireball removes the defenders.",
    core: ["Graveyard", "Bowler"],
    primaryWinConditions: ["Graveyard"],
    slots: [
      { id: "yard", label: "win condition", options: ["Graveyard"] },
      {
        id: "tank",
        label: "splash tank",
        options: ["Bowler", "Golden Knight", "Knight"],
      },
      { id: "poison", label: "big spell", options: ["Poison", "Fireball"] },
      {
        id: "air",
        label: "air defense",
        options: ["Archers", "Mega Minion", "Minions", "Musketeer"],
      },
      {
        id: "small-spell",
        label: "small spell",
        options: ["Royal Delivery", "Barbarian Barrel", "The Log"],
      },
      {
        id: "control",
        label: "control troop",
        options: ["Ice Wizard", "Electro Wizard", "Wizard"],
      },
      {
        id: "cycle",
        label: "cycle card",
        options: ["Goblin Gang", "Skeletons", "Guards"],
      },
      {
        id: "champion",
        label: "second tank or champion",
        options: ["Knight", "Skeleton King", "Mighty Miner"],
      },
    ],
  },
  {
    id: "skeleton-barrel-bait",
    name: "Skeleton Barrel Bait",
    tier: "A",
    support: 62,
    summary:
      "Skeleton Barrel only connects when Goblin Gang and Skeleton Army have already spent the opponent's small spell.",
    core: ["Skeleton Barrel", "Goblin Gang", "Skeleton Army"],
    primaryWinConditions: ["Skeleton Barrel"],
    slots: [
      { id: "barrel", label: "win condition", options: ["Skeleton Barrel"] },
      { id: "gang", label: "bait swarm", options: ["Goblin Gang", "Guards"] },
      {
        id: "army",
        label: "second bait swarm",
        options: ["Skeleton Army", "Bats", "Minions"],
      },
      {
        id: "air",
        label: "air defense",
        options: ["Minions", "Mega Minion", "Archers", "Princess"],
      },
      {
        id: "champion",
        label: "champion",
        options: ["Golden Knight", "Mighty Miner", "Knight"],
      },
      { id: "big-spell", label: "big spell", options: ["Fireball", "Poison"] },
      {
        id: "small-spell",
        label: "small spell",
        options: ["Royal Delivery", "Barbarian Barrel", "The Log", "Arrows"],
      },
      {
        id: "tank",
        label: "counterpush tank",
        options: ["P.E.K.K.A", "Bowler", "Knight"],
      },
    ],
  },
  {
    id: "pekka-graveyard",
    name: "P.E.K.K.A Graveyard",
    tier: "B",
    support: 40,
    summary:
      "P.E.K.K.A clears the defense and Graveyard finishes the tower. It is heavy, so the rest of the deck has to stay cheap.",
    core: ["P.E.K.K.A", "Graveyard"],
    primaryWinConditions: ["Graveyard"],
    slots: [
      { id: "pekka", label: "tank", options: ["P.E.K.K.A"] },
      { id: "yard", label: "win condition", options: ["Graveyard"] },
      {
        id: "splash",
        label: "splash",
        options: ["Bowler", "Wizard", "Baby Dragon"],
      },
      { id: "spell", label: "big spell", options: ["Poison", "Fireball"] },
      {
        id: "air",
        label: "air defense",
        options: ["Minions", "Archers", "Mega Minion"],
      },
      {
        id: "small-spell",
        label: "small spell",
        options: ["Royal Delivery", "Barbarian Barrel", "The Log"],
      },
      {
        id: "support",
        label: "support",
        options: ["Knight", "Golden Knight", "Lumberjack"],
      },
      {
        id: "cycle",
        label: "cycle card",
        options: ["Goblin Gang", "Skeletons", "Ice Spirit"],
      },
    ],
  },
];
