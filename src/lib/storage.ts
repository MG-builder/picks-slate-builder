import type { Config, Entity, Mechanic, Slate } from "../types";
import { seedMechanics } from "../data/mechanics";
import { seedEntities } from "../data/entities";
import { seedWindows } from "../data/windows";
import { seedRuleConfig } from "../data/ruleConfig";

const KEYS = {
  config: "psb.v1.config",
  slates: "psb.v1.slates",
  draft: "psb.v1.draft",
};

/** The slate open in Review. Kept separately from saved history so a refresh does not lose it. */
export interface Draft {
  slate: Slate;
  readOnly: boolean;
  /** True when the working copy differs from what is saved in history. */
  dirty: boolean;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app keeps working in memory.
  }
}

/**
 * Seed additions by revision. A saved config below a revision gets that revision's mechanics
 * (unticked) and entities appended (unless already present), once. Anything the user deletes afterwards
 * stays deleted, because the config is then at the new revision.
 */
const SEED_ADDITIONS: { revision: number; mechanics: string[]; entities: string[] }[] = [
  {
    revision: 2,
    mechanics: [
      "mech-teammates-assisted-goal",
      "mech-any-of-three-score",
      "mech-pair-combined-goals",
      "mech-strikers-combined-goals",
      "mech-score-both-gameweeks",
      "mech-duo-involvements",
      "mech-score-and-team-win",
      "mech-outscore",
      "mech-both-score-twice",
    ],
    entities: ["tm-mancity", "tm-manutd", "tm-chelsea", "tm-arsenal", "tm-liverpool"],
  },
];
export const SEED_REVISION = Math.max(1, ...SEED_ADDITIONS.map((a) => a.revision));

export function seedConfig(): Config {
  return structuredClone({
    revision: SEED_REVISION,
    mechanics: seedMechanics,
    entities: seedEntities,
    windows: seedWindows,
    rules: seedRuleConfig,
  });
}

/**
 * Brings data saved by earlier versions up to date.
 * - Config saved before mechanics had slots (the player-markets rework) is replaced with the
 *   seed, because the old mechanics, entities and windows no longer apply.
 * - Config saved with phases: a mechanic is ticked if its phase was live, and gets the seed's
 *   count (or 2 for mechanics not in the seed).
 * - Retired mechanics are removed (see RETIRED_MECHANICS).
 * - Mechanics gain `windowFloor` (gameweek), and seed additions are applied by revision
 *   (see SEED_ADDITIONS).
 * - Slates saved with `secondEntityId` get `otherEntityIds`; older slates have every market on
 *   the slate and are unpublished.
 */
type Legacy<T> = T & Record<string, unknown>;

/**
 * Mechanics removed because they were wrong, not just unused: "A scores, B assists" across
 * different matches cannot happen (an assist is always on a teammate's goal).
 */
const RETIRED_MECHANICS = new Set(["mech-cross-score-assist"]);

function migrateConfig(c: Legacy<Config>): Config {
  const reworked =
    c.mechanics.every((m) => Array.isArray(m.slots)) &&
    c.entities.every((e) => Array.isArray(e.tags)) &&
    c.windows.every((w) => Array.isArray(w.fixtures));
  if (!reworked) return seedConfig();

  const rules = c.rules as Legacy<Config["rules"]>;
  const livePhases = rules.livePhases as number[] | undefined;
  const seedCounts = new Map(seedMechanics.map((m) => [m.id, m.count]));
  let mechanics: Mechanic[] = c.mechanics.filter((m) => !RETIRED_MECHANICS.has(m.id)).map((m) => {
    const { phase, ...rest } = m as Legacy<typeof m>;
    return {
      ...rest,
      windowFloor: m.windowFloor ?? "gameweek",
      enabled: m.enabled ?? (livePhases ? livePhases.includes(phase as number) : true),
      count: m.count ?? seedCounts.get(m.id) ?? 2,
    };
  });
  let entities: Entity[] = c.entities;
  const from = typeof c.revision === "number" ? c.revision : 1;
  for (const add of SEED_ADDITIONS.filter((a) => a.revision > from)) {
    const haveM = new Set(mechanics.map((m) => m.id));
    const haveE = new Set(entities.map((e) => e.id));
    // Added unticked, so an existing slate setup does not change without the user choosing it.
    const added = seedMechanics.filter((m) => add.mechanics.includes(m.id) && !haveM.has(m.id));
    mechanics = [...mechanics, ...added.map((m) => ({ ...m, enabled: false }))];
    entities = [...entities, ...seedEntities.filter((e) => add.entities.includes(e.id) && !haveE.has(e.id))];
  }
  return {
    ...c,
    revision: Math.max(from, SEED_REVISION),
    mechanics: structuredClone(mechanics),
    entities: structuredClone(entities),
    rules: {
      slateSize:
        typeof rules.slateSize === "number" ? rules.slateSize : seedRuleConfig.slateSize,
      groupCap: rules.groupCap ?? seedRuleConfig.groupCap,
    },
  };
}

function migrateSlate(s: Slate): Slate {
  return {
    ...s,
    publishedAt: s.publishedAt ?? null,
    markets: s.markets.map((m) => {
      const legacy = m as Legacy<typeof m>;
      const second = legacy.secondEntityId as string | null | undefined;
      return {
        ...m,
        otherEntityIds: m.otherEntityIds ?? (second ? [second] : []),
        onSlate: m.onSlate ?? true,
      };
    }),
  };
}

export const loadConfig = () => migrateConfig(read<Legacy<Config>>(KEYS.config, seedConfig() as Legacy<Config>));
export const saveConfig = (c: Config) => write(KEYS.config, c);
export const loadSlates = () => read<Slate[]>(KEYS.slates, []).map(migrateSlate);
export const saveSlates = (s: Slate[]) => write(KEYS.slates, s);
export const loadDraft = () => {
  const d = read<Draft | null>(KEYS.draft, null);
  return d ? { ...d, slate: migrateSlate(d.slate) } : null;
};
export const saveDraft = (d: Draft | null) => write(KEYS.draft, d);
