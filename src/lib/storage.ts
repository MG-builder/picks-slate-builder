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
 * Config saved before mechanics had slots (the player-markets rework) is replaced with the
 * seed, because the old mechanics, entities and windows no longer apply.
 * Slates saved with `secondEntityId` get `otherEntityIds`.
 */
type Legacy<T> = T & Record<string, unknown>;

function migrateConfig(c: Legacy<Config>): Config {
  const current =
    c.mechanics.every((m) => Array.isArray(m.slots)) &&
    c.entities.every((e) => Array.isArray(e.tags)) &&
    c.windows.every((w) => Array.isArray(w.fixtures));
  return current ? c : seedConfig();
}

function migrateSlate(s: Slate): Slate {
  return {
    ...s,
    markets: s.markets.map((m) => {
      const legacy = m as Legacy<typeof m>;
      if (m.otherEntityIds) return m;
      const second = legacy.secondEntityId as string | null | undefined;
      return { ...m, otherEntityIds: second ? [second] : [] };
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
