import {
  accountCoachSchema,
  type AccountCoachAnalysis,
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
    catalog.flatMap((brawler) => select(brawler).map((item) => nameKey(item.name))),
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

export function validateRecommendations(
  input: unknown,
  player: PlayerProfile,
  catalog: BrawlerCatalogItem[],
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

  return validated;
}
