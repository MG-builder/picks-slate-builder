import type { Config, Slate } from "../types";
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

export function seedConfig(): Config {
  return structuredClone({
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
 * - Slates saved with `secondEntityId` get `otherEntityIds`; older slates have every market on
 *   the slate and are unpublished.
 */
type Legacy<T> = T & Record<string, unknown>;

function migrateConfig(c: Legacy<Config>): Config {
  const reworked =
    c.mechanics.every((m) => Array.isArray(m.slots)) &&
    c.entities.every((e) => Array.isArray(e.tags)) &&
    c.windows.every((w) => Array.isArray(w.fixtures));
  if (!reworked) return seedConfig();

  const rules = c.rules as Legacy<Config["rules"]>;
  const livePhases = rules.livePhases as number[] | undefined;
  const seedCounts = new Map(seedMechanics.map((m) => [m.id, m.count]));
  return {
    ...c,
    mechanics: c.mechanics.map((m) => {
      const { phase, ...rest } = m as Legacy<typeof m>;
      return {
        ...rest,
        enabled: m.enabled ?? (livePhases ? livePhases.includes(phase as number) : true),
        count: m.count ?? seedCounts.get(m.id) ?? 2,
      };
    }),
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
