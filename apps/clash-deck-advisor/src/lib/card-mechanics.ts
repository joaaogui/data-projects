/**
 * Mechanics that deck gates actually use.
 *
 * Role tags such as "win condition" were too coarse: Bandit and Golden Knight
 * scored like Hog Rider, and Elixir Collector counted as a tank answer.
 */

export const PRIMARY_WIN_CONDITIONS = new Set([
  "Hog Rider",
  "Royal Hogs",
  "Wall Breakers",
  "Goblin Barrel",
  "Skeleton Barrel",
  "Miner",
  "Graveyard",
  "Balloon",
  "Giant",
  "Goblin Giant",
  "Golem",
  "Electro Giant",
  "Lava Hound",
  "Royal Giant",
  "X-Bow",
  "Mortar",
  "Goblin Drill",
  "Ram Rider",
  "Battle Ram",
  "Elixir Golem",
  "Three Musketeers",
]);

export const DEFENSIVE_BUILDINGS = new Set([
  "Cannon",
  "Tesla",
  "Bomb Tower",
  "Inferno Tower",
  "Goblin Cage",
]);

export const PUMPS = new Set(["Elixir Collector"]);

export const RELIABLE_AIR = new Set([
  "Musketeer",
  "Archers",
  "Mega Minion",
  "Minions",
  "Minion Horde",
  "Electro Wizard",
  "Magic Archer",
  "Hunter",
  "Executioner",
  "Wizard",
  "Flying Machine",
  "Inferno Dragon",
  "Baby Dragon",
  "Electro Dragon",
  "Phoenix",
  "Little Prince",
  "Mother Witch",
  "Firecracker",
  "Dart Goblin",
]);

/** Reaches air, but cannot be the deck's only answer to Balloon. */
export const MEDIUM_AIR = new Set([
  "Witch",
  "Bats",
  "Princess",
  "Spear Goblins",
  "Goblin Gang",
  "Ice Wizard",
  "Zappies",
  "Rascals",
]);

export const SMALL_DAMAGE_SPELLS = new Set([
  "The Log",
  "Zap",
  "Arrows",
  "Barbarian Barrel",
  "Giant Snowball",
  "Royal Delivery",
  "Earthquake",
]);

export const BIG_DAMAGE_SPELLS = new Set([
  "Fireball",
  "Poison",
  "Rocket",
  "Lightning",
  "Void",
]);

/** Two of these in one deck donate a Fireball or Poison on every push. */
export const SPELL_MAGNETS = new Set(["Wizard", "Witch", "Executioner"]);

export function isPrimaryWinCondition(name: string): boolean {
  return PRIMARY_WIN_CONDITIONS.has(name);
}

export function airQuality(names: string[]): "reliable" | "thin" | "none" {
  if (names.some((name) => RELIABLE_AIR.has(name))) return "reliable";
  if (names.filter((name) => MEDIUM_AIR.has(name)).length >= 2) return "thin";
  return "none";
}
