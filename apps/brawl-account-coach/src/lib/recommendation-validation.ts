import {
  accountCoachSchema,
  type AccountCoachAnalysis,
  type BuildAdvice,
  type PlayerPreferences,
  type PushTarget,
  type UpgradePriority,
} from "./schemas";
import type {
  BrawlerCatalogItem,
  NamedItem,
  PlayerBrawler,
  PlayerProfile,
} from "./types";

function nameKey(name: string): string {
  return name.trim().toLocaleUpperCase().replace(/[^A-Z0-9]/g, "");
}

function createItemCatalog(
  catalog: BrawlerCatalogItem[],
  select: (brawler: BrawlerCatalogItem) => NamedItem[],
): Set<string> {
  return new Set(
    catalog.flatMap((brawler) =>
      select(brawler).map((item) => nameKey(item.name)),
    ),
  );
}

function ownedItem(
  value: string,
  label: string,
  brawler: PlayerBrawler,
  owned: NamedItem[],
  catalogNames: Set<string>,
): string;
function ownedItem(
  value: null,
  label: string,
  brawler: PlayerBrawler,
  owned: NamedItem[],
  catalogNames: Set<string>,
): null;
function ownedItem(
  value: string | null,
  label: string,
  brawler: PlayerBrawler,
  owned: NamedItem[],
  catalogNames: Set<string>,
): string | null;
function ownedItem(
  value: string | null,
  label: string,
  brawler: PlayerBrawler,
  owned: NamedItem[],
  catalogNames: Set<string>,
): string | null {
  if (value === null) {
    return null;
  }

  const key = nameKey(value);
  if (!catalogNames.has(key)) {
    throw new Error(`Unknown ${label} for ${brawler.name}: ${value}`);
  }

  const match = owned.find((item) => nameKey(item.name) === key);
  if (!match) {
    throw new Error(
      `Player does not own ${label} for ${brawler.name}: ${value}`,
    );
  }
  return match.name;
}

function assertUniqueBrawlers(
  items: { brawlerName: string }[],
  label: string,
) {
  const names = items.map((item) => item.brawlerName);
  if (new Set(names).size !== names.length) {
    throw new Error(`${label} contains duplicate brawlers`);
  }
}

export function applyBrawlerPreferences(
  analysis: AccountCoachAnalysis,
  player: PlayerProfile,
  preferences?: PlayerPreferences,
): AccountCoachAnalysis {
  if (
    !preferences ||
    (preferences.pinnedBrawlers.length === 0 &&
      preferences.excludedBrawlers.length === 0)
  ) {
    return analysis;
  }

  const ownedByKey = new Map(
    player.brawlers.map((brawler) => [nameKey(brawler.name), brawler]),
  );

  const excludedKeys = new Set(
    preferences.excludedBrawlers.map((name) => nameKey(name)),
  );
  const pinnedBrawlers: PlayerBrawler[] = [];
  const pinnedKeys = new Set<string>();

  for (const rawName of preferences.pinnedBrawlers) {
    const key = nameKey(rawName);
    if (excludedKeys.has(key) || pinnedKeys.has(key)) {
      continue;
    }
    const owned = ownedByKey.get(key);
    if (owned) {
      pinnedKeys.add(key);
      pinnedBrawlers.push(owned);
    }
  }

  const filteredUpgrades = analysis.upgradePriorities.filter(
    (item) => !excludedKeys.has(nameKey(item.brawlerName)),
  );
  const existingUpgradeByKey = new Map(
    filteredUpgrades.map((item) => [nameKey(item.brawlerName), item]),
  );

  const boostedUpgrades: UpgradePriority[] = [];
  for (const brawler of pinnedBrawlers) {
    const key = nameKey(brawler.name);
    const existing = existingUpgradeByKey.get(key);
    if (existing) {
      boostedUpgrades.push({
        ...existing,
        accountImpact: "high",
      });
    } else if (brawler.power < 11) {
      boostedUpgrades.push({
        brawlerName: brawler.name,
        currentPower: brawler.power,
        currentTrophies: brawler.trophies,
        accountImpact: "high",
        reason: `Pinned focus brawler at Power ${brawler.power} — prioritize power breakpoints and core build pieces.`,
      });
    }
  }
  for (const item of filteredUpgrades) {
    if (!pinnedKeys.has(nameKey(item.brawlerName))) {
      boostedUpgrades.push(item);
    }
  }

  const filteredPushes = analysis.pushTargets.filter(
    (item) => !excludedKeys.has(nameKey(item.brawlerName)),
  );
  const existingPushByKey = new Map(
    filteredPushes.map((item) => [nameKey(item.brawlerName), item]),
  );

  const boostedPushes: PushTarget[] = [];
  for (const brawler of pinnedBrawlers) {
    const key = nameKey(brawler.name);
    const existing = existingPushByKey.get(key);
    if (existing) {
      boostedPushes.push(existing);
    } else {
      const targetTrophies = Math.max(
        brawler.highestTrophies,
        brawler.trophies + 75,
      );
      boostedPushes.push({
        brawlerName: brawler.name,
        currentTrophies: brawler.trophies,
        targetTrophies:
          targetTrophies > brawler.trophies
            ? targetTrophies
            : brawler.trophies + 75,
        reason: `Pinned focus brawler — target steady trophy gains on favored rotation maps.`,
      });
    }
  }
  for (const item of filteredPushes) {
    if (!pinnedKeys.has(nameKey(item.brawlerName))) {
      boostedPushes.push(item);
    }
  }

  const filteredBuilds = analysis.buildAdvice.filter(
    (item) => !excludedKeys.has(nameKey(item.brawlerName)),
  );
  const existingBuildByKey = new Map(
    filteredBuilds.map((item) => [nameKey(item.brawlerName), item]),
  );
  const boostedBuilds: BuildAdvice[] = [];

  for (const brawler of pinnedBrawlers) {
    const key = nameKey(brawler.name);
    const existing = existingBuildByKey.get(key);
    if (existing) {
      boostedBuilds.push(existing);
    } else if (
      brawler.gadgets.length > 0 ||
      brawler.starPowers.length > 0 ||
      brawler.gears.length > 0 ||
      brawler.hyperCharges.length > 0
    ) {
      boostedBuilds.push({
        brawlerName: brawler.name,
        gadget: brawler.gadgets[0]?.name ?? null,
        starPower: brawler.starPowers[0]?.name ?? null,
        gears: brawler.gears.slice(0, 2).map((gear) => gear.name),
        hypercharge: brawler.hyperCharges[0]?.name ?? null,
        reason:
          "Equipped from your owned loadout pieces for your pinned focus brawler.",
      });
    }
  }
  for (const item of filteredBuilds) {
    if (!pinnedKeys.has(nameKey(item.brawlerName))) {
      boostedBuilds.push(item);
    }
  }

  return {
    ...analysis,
    upgradePriorities: boostedUpgrades.slice(0, 5),
    pushTargets: boostedPushes.slice(0, 5),
    buildAdvice: boostedBuilds.slice(0, 5),
    avoidForNow: analysis.avoidForNow.filter(
      (item) => !pinnedKeys.has(nameKey(item.brawlerName)),
    ),
  };
}

export function validateRecommendations(
  input: unknown,
  player: PlayerProfile,
  catalog: BrawlerCatalogItem[],
  preferences?: PlayerPreferences,
): AccountCoachAnalysis {
  const analysis = accountCoachSchema.parse(input);
  const catalogNames = new Set(catalog.map((brawler) => nameKey(brawler.name)));
  const ownedBrawlers = new Map(
    player.brawlers.map((brawler) => [nameKey(brawler.name), brawler]),
  );
  const gadgetCatalog = createItemCatalog(
    catalog,
    (brawler) => brawler.gadgets,
  );
  const starPowerCatalog = createItemCatalog(
    catalog,
    (brawler) => brawler.starPowers,
  );
  const gearCatalog = createItemCatalog(catalog, (brawler) => brawler.gears);
  const hyperchargeCatalog = createItemCatalog(
    catalog,
    (brawler) => brawler.hyperCharges,
  );

  const resolveBrawler = (value: string): PlayerBrawler => {
    const key = nameKey(value);
    const brawler = ownedBrawlers.get(key);
    if (!brawler || !catalogNames.has(key)) {
      throw new Error(`Unknown or unowned brawler: ${value}`);
    }
    return brawler;
  };

  const validated: AccountCoachAnalysis = {
    ...analysis,
    upgradePriorities: analysis.upgradePriorities.map((priority) => {
      const brawler = resolveBrawler(priority.brawlerName);
      if (
        priority.currentPower !== brawler.power ||
        priority.currentTrophies !== brawler.trophies
      ) {
        throw new Error(
          `Upgrade facts do not match live data for ${brawler.name}`,
        );
      }
      return { ...priority, brawlerName: brawler.name };
    }),
    pushTargets: analysis.pushTargets.map((target) => {
      const brawler = resolveBrawler(target.brawlerName);
      if (target.currentTrophies !== brawler.trophies) {
        throw new Error(`Push facts do not match live data for ${brawler.name}`);
      }
      if (target.targetTrophies <= target.currentTrophies) {
        throw new Error(
          `Push target must exceed current trophies for ${brawler.name}`,
        );
      }
      return { ...target, brawlerName: brawler.name };
    }),
    buildAdvice: analysis.buildAdvice.map((build) => {
      const brawler = resolveBrawler(build.brawlerName);
      const gears = build.gears.map((gear) =>
        ownedItem(gear, "gear", brawler, brawler.gears, gearCatalog),
      );
      if (new Set(gears).size !== gears.length) {
        throw new Error(`Build advice contains duplicate gears for ${brawler.name}`);
      }

      return {
        ...build,
        brawlerName: brawler.name,
        gadget: ownedItem(
          build.gadget,
          "gadget",
          brawler,
          brawler.gadgets,
          gadgetCatalog,
        ),
        starPower: ownedItem(
          build.starPower,
          "Star Power",
          brawler,
          brawler.starPowers,
          starPowerCatalog,
        ),
        gears,
        hypercharge: ownedItem(
          build.hypercharge,
          "Hypercharge",
          brawler,
          brawler.hyperCharges,
          hyperchargeCatalog,
        ),
      };
    }),
    battleDiagnosis: analysis.battleDiagnosis.map((diagnosis) => ({
      ...diagnosis,
      brawlerName: resolveBrawler(diagnosis.brawlerName).name,
    })),
    avoidForNow: analysis.avoidForNow.map((investment) => ({
      ...investment,
      brawlerName: resolveBrawler(investment.brawlerName).name,
    })),
  };

  assertUniqueBrawlers(validated.upgradePriorities, "Upgrade priorities");
  assertUniqueBrawlers(validated.pushTargets, "Push targets");
  assertUniqueBrawlers(validated.buildAdvice, "Build advice");
  assertUniqueBrawlers(validated.avoidForNow, "Avoid-for-now list");

  return applyBrawlerPreferences(validated, player, preferences);
}
