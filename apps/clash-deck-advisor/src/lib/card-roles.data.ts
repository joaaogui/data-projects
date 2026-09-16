/**
 * Static gameplay attributes per card.
 *
 * The Clash Royale API returns level, elixir, rarity, and evolution state but
 * says nothing about what a card actually does. These attributes supply the
 * missing tactical meaning that deck scoring depends on.
 */

export type CardRole =
  | "winCondition"
  | "tank"
  | "tankKiller"
  | "splash"
  | "airDefense"
  | "support"
  | "swarm"
  | "cycle"
  | "building"
  | "spellSmall"
  | "spellBig";

export type Archetype =
  | "cycle"
  | "beatdown"
  | "control"
  | "bait"
  | "siege"
  | "bridgeSpam";

export interface CardAttributes {
  roles: CardRole[];
  /** What this card is able to attack. Spells use their damage coverage. */
  targets: "ground" | "air" | "both" | "none";
  /** Flying units can only be answered by air-capable cards. */
  isAirUnit?: boolean;
  /**
   * Set for cards that reach air but cannot be relied on to kill it, either
   * because their damage is negligible or because they evaporate to splash.
   * A deck defended only by these loses to Balloon and Lava Hound.
   */
  weakAirDefense?: boolean;
  /**
   * Set for spells that deal no damage. They can be excellent in the right
   * deck, but they do not satisfy a deck's need for a spell that can finish
   * a tower or clear support troops.
   */
  utilitySpell?: boolean;
  archetypes?: Archetype[];
}

export const CARD_ATTRIBUTES: Record<string, CardAttributes> = {
  // 1 elixir
  "Electro Spirit": { roles: ["cycle", "support"], targets: "both" },
  "Fire Spirit": { roles: ["cycle", "splash"], targets: "both" },
  "Heal Spirit": { roles: ["cycle", "support"], targets: "none" },
  "Ice Spirit": {
    roles: ["cycle", "support"],
    targets: "both",
    archetypes: ["cycle"],
  },
  Skeletons: {
    roles: ["cycle", "swarm"],
    targets: "ground",
    archetypes: ["cycle"],
  },

  // 2 elixir
  "Barbarian Barrel": { roles: ["spellSmall"], targets: "ground" },
  Bats: {
    roles: ["cycle", "swarm", "airDefense"],
    targets: "both",
    isAirUnit: true,
  },
  Berserker: { roles: ["cycle", "support"], targets: "ground" },
  Bomber: { roles: ["splash", "support"], targets: "ground" },
  "Giant Snowball": { roles: ["spellSmall"], targets: "both" },
  "Goblin Curse": { roles: ["spellSmall"], targets: "both" },
  Goblins: { roles: ["cycle", "swarm"], targets: "ground" },
  "Ice Golem": {
    roles: ["cycle", "tank", "support"],
    targets: "ground",
    archetypes: ["cycle"],
  },
  Rage: {
    roles: ["spellSmall"],
    targets: "none",
    utilitySpell: true,
  },
  "Spear Goblins": {
    roles: ["cycle", "swarm", "airDefense"],
    targets: "both",
    weakAirDefense: true,
  },
  "Suspicious Bush": { roles: ["cycle", "support"], targets: "ground" },
  "The Log": {
    roles: ["spellSmall"],
    targets: "ground",
    archetypes: ["cycle", "bait", "control"],
  },
  "Wall Breakers": {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["cycle", "bridgeSpam"],
  },
  Zap: { roles: ["spellSmall"], targets: "both", archetypes: ["bait"] },

  // 3 elixir
  Archers: { roles: ["support", "airDefense"], targets: "both" },
  Arrows: { roles: ["spellSmall"], targets: "both", archetypes: ["bait"] },
  Bandit: {
    roles: ["winCondition", "tankKiller"],
    targets: "ground",
    archetypes: ["bridgeSpam"],
  },
  Cannon: {
    roles: ["building"],
    targets: "ground",
    archetypes: ["cycle", "control"],
  },
  Clone: {
    roles: ["spellSmall"],
    targets: "none",
    utilitySpell: true,
  },
  "Dart Goblin": {
    roles: ["support", "airDefense"],
    targets: "both",
    archetypes: ["bait"],
  },
  Earthquake: { roles: ["spellSmall"], targets: "ground" },
  "Elixir Golem": {
    roles: ["tank"],
    targets: "ground",
    archetypes: ["beatdown"],
  },
  Firecracker: {
    roles: ["support", "airDefense", "splash"],
    targets: "both",
  },
  Fisherman: { roles: ["support", "tankKiller"], targets: "ground" },
  "Goblin Barrel": {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["bait"],
  },
  "Goblin Gang": {
    roles: ["swarm", "airDefense"],
    targets: "both",
    weakAirDefense: true,
    archetypes: ["bait"],
  },
  Guards: { roles: ["swarm", "tankKiller"], targets: "ground" },
  "Ice Wizard": {
    roles: ["support", "splash", "airDefense"],
    targets: "both",
    weakAirDefense: true,
    archetypes: ["control"],
  },
  Knight: {
    roles: ["tank", "support"],
    targets: "ground",
    archetypes: ["cycle", "control"],
  },
  "Little Prince": {
    roles: ["support", "airDefense"],
    targets: "both",
  },
  "Mega Minion": {
    roles: ["airDefense", "support"],
    targets: "both",
    isAirUnit: true,
  },
  Miner: {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["control", "cycle"],
  },
  Minions: {
    roles: ["swarm", "airDefense"],
    targets: "both",
    isAirUnit: true,
  },
  Princess: {
    roles: ["support", "splash", "airDefense"],
    targets: "both",
    archetypes: ["bait"],
  },
  "Royal Delivery": { roles: ["spellSmall", "support"], targets: "both" },
  "Royal Ghost": {
    roles: ["support", "splash"],
    targets: "ground",
    archetypes: ["bridgeSpam"],
  },
  "Skeleton Army": {
    roles: ["swarm", "tankKiller"],
    targets: "ground",
    archetypes: ["bait"],
  },
  "Skeleton Barrel": {
    roles: ["winCondition"],
    targets: "ground",
    isAirUnit: true,
    archetypes: ["bait"],
  },
  Tombstone: { roles: ["building", "swarm"], targets: "none" },
  Tornado: {
    roles: ["spellSmall"],
    targets: "both",
    archetypes: ["control"],
  },
  Vines: { roles: ["spellSmall"], targets: "both" },

  // 4 elixir
  "Baby Dragon": {
    roles: ["splash", "airDefense", "support"],
    targets: "both",
    isAirUnit: true,
    archetypes: ["beatdown"],
  },
  "Battle Healer": { roles: ["support", "tank"], targets: "ground" },
  "Battle Ram": {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["bridgeSpam"],
  },
  "Bomb Tower": { roles: ["building", "splash"], targets: "ground" },
  "Dark Prince": {
    roles: ["splash", "support", "tank"],
    targets: "ground",
    archetypes: ["bridgeSpam"],
  },
  "Electro Wizard": {
    roles: ["support", "airDefense", "tankKiller"],
    targets: "both",
  },
  Fireball: {
    roles: ["spellBig"],
    targets: "both",
    archetypes: ["cycle", "control"],
  },
  "Flying Machine": {
    roles: ["support", "airDefense"],
    targets: "both",
    isAirUnit: true,
  },
  Freeze: {
    roles: ["spellBig"],
    targets: "none",
    utilitySpell: true,
  },
  Furnace: { roles: ["building"], targets: "none" },
  "Goblin Cage": { roles: ["building", "tankKiller"], targets: "ground" },
  "Goblin Demolisher": { roles: ["support", "splash"], targets: "ground" },
  "Goblin Drill": {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["control"],
  },
  "Goblin Hut": { roles: ["building"], targets: "none" },
  "Golden Knight": {
    roles: ["winCondition", "support", "tank"],
    targets: "ground",
    archetypes: ["bridgeSpam"],
  },
  "Hog Rider": {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["cycle"],
  },
  Hunter: { roles: ["tankKiller", "airDefense"], targets: "both" },
  "Inferno Dragon": {
    roles: ["tankKiller", "airDefense"],
    targets: "both",
    isAirUnit: true,
  },
  Lumberjack: {
    roles: ["tankKiller", "support"],
    targets: "ground",
    archetypes: ["beatdown"],
  },
  "Magic Archer": {
    roles: ["support", "splash", "airDefense"],
    targets: "both",
    archetypes: ["control"],
  },
  "Mighty Miner": { roles: ["tankKiller"], targets: "ground" },
  "Mini P.E.K.K.A": { roles: ["tankKiller"], targets: "ground" },
  Mortar: {
    roles: ["winCondition", "building"],
    targets: "ground",
    archetypes: ["siege", "cycle"],
  },
  "Mother Witch": { roles: ["support", "splash"], targets: "both" },
  Musketeer: {
    roles: ["support", "airDefense", "tankKiller"],
    targets: "both",
    archetypes: ["cycle", "control"],
  },
  "Night Witch": {
    roles: ["support", "swarm"],
    targets: "ground",
    archetypes: ["beatdown"],
  },
  Phoenix: {
    roles: ["airDefense", "support"],
    targets: "both",
    isAirUnit: true,
  },
  Poison: {
    roles: ["spellBig"],
    targets: "both",
    archetypes: ["control"],
  },
  "Rune Giant": { roles: ["tank", "support"], targets: "ground" },
  "Skeleton Dragons": {
    roles: ["splash", "airDefense"],
    targets: "both",
    isAirUnit: true,
  },
  "Skeleton King": { roles: ["tank", "swarm"], targets: "ground" },
  Tesla: {
    roles: ["building", "airDefense"],
    targets: "both",
    archetypes: ["cycle", "siege"],
  },
  Valkyrie: {
    roles: ["splash", "tank", "support"],
    targets: "ground",
    archetypes: ["control"],
  },
  Zappies: {
    roles: ["support", "airDefense"],
    targets: "both",
    weakAirDefense: true,
  },

  "Minion Giant": {
    roles: ["tank", "winCondition"],
    targets: "ground",
    isAirUnit: true,
    archetypes: ["beatdown"],
  },

  // 5 elixir
  "Archer Queen": {
    roles: ["support", "airDefense", "tankKiller"],
    targets: "both",
  },
  Goblinstein: { roles: ["tankKiller", "support"], targets: "ground" },
  Monk: { roles: ["support", "tankKiller"], targets: "ground" },
  Balloon: {
    roles: ["winCondition"],
    targets: "ground",
    isAirUnit: true,
    archetypes: ["beatdown"],
  },
  Barbarians: { roles: ["swarm", "tankKiller"], targets: "ground" },
  Bowler: { roles: ["splash", "support"], targets: "ground" },
  "Cannon Cart": { roles: ["support", "tank"], targets: "ground" },
  "Electro Dragon": {
    roles: ["airDefense", "splash", "support"],
    targets: "both",
    isAirUnit: true,
  },
  Executioner: {
    roles: ["splash", "airDefense"],
    targets: "both",
    archetypes: ["control"],
  },
  Giant: {
    roles: ["winCondition", "tank"],
    targets: "ground",
    archetypes: ["beatdown"],
  },
  "Goblin Machine": { roles: ["winCondition", "tank"], targets: "ground" },
  Graveyard: {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["control"],
  },
  "Inferno Tower": {
    roles: ["building", "tankKiller"],
    targets: "both",
    archetypes: ["control"],
  },
  "Minion Horde": {
    roles: ["swarm", "airDefense"],
    targets: "both",
    isAirUnit: true,
  },
  Prince: { roles: ["tankKiller", "winCondition"], targets: "ground" },
  "Ram Rider": {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["bridgeSpam"],
  },
  Rascals: {
    roles: ["swarm", "airDefense"],
    targets: "both",
    weakAirDefense: true,
  },
  Ronin: { roles: ["tankKiller", "support"], targets: "ground" },
  "Royal Hogs": {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["cycle"],
  },
  Void: { roles: ["spellBig"], targets: "both" },
  Witch: {
    roles: ["swarm", "splash", "airDefense"],
    targets: "both",
  },
  Wizard: { roles: ["splash", "airDefense"], targets: "both" },

  // 6 elixir
  "Barbarian Hut": { roles: ["building"], targets: "none" },
  "Boss Bandit": {
    roles: ["winCondition", "tankKiller"],
    targets: "ground",
    archetypes: ["bridgeSpam"],
  },
  "Elite Barbarians": {
    roles: ["winCondition", "tankKiller"],
    targets: "ground",
  },
  "Elixir Collector": { roles: ["building"], targets: "none" },
  "Giant Skeleton": { roles: ["tank", "splash"], targets: "ground" },
  "Goblin Giant": {
    roles: ["winCondition", "tank"],
    targets: "ground",
    archetypes: ["beatdown"],
  },
  Lightning: { roles: ["spellBig"], targets: "both" },
  Rocket: { roles: ["spellBig"], targets: "both" },
  "Royal Giant": {
    roles: ["winCondition"],
    targets: "ground",
    archetypes: ["beatdown", "control"],
  },
  Sparky: { roles: ["tankKiller", "splash"], targets: "ground" },
  "Spirit Empress": { roles: ["support", "splash"], targets: "both" },
  "X-Bow": {
    roles: ["winCondition", "building"],
    targets: "ground",
    archetypes: ["siege"],
  },

  // 7 elixir
  "Electro Giant": {
    roles: ["winCondition", "tank"],
    targets: "ground",
    archetypes: ["beatdown"],
  },
  "Lava Hound": {
    roles: ["winCondition", "tank"],
    targets: "ground",
    isAirUnit: true,
    archetypes: ["beatdown"],
  },
  "Mega Knight": {
    roles: ["tank", "splash", "tankKiller"],
    targets: "ground",
  },
  "P.E.K.K.A": {
    roles: ["tankKiller", "tank"],
    targets: "ground",
    archetypes: ["bridgeSpam", "beatdown"],
  },
  "Royal Recruits": { roles: ["swarm", "tank"], targets: "ground" },

  // 8+ elixir
  Golem: {
    roles: ["winCondition", "tank"],
    targets: "ground",
    archetypes: ["beatdown"],
  },
  "Three Musketeers": {
    roles: ["support", "airDefense", "winCondition"],
    targets: "both",
  },

  // Special
  Mirror: { roles: ["support"], targets: "none" },
};
