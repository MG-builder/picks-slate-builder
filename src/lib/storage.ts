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

export const loadConfig = () => read<Config>(KEYS.config, seedConfig());
export const saveConfig = (c: Config) => write(KEYS.config, c);
export const loadSlates = () => read<Slate[]>(KEYS.slates, []);
export const saveSlates = (s: Slate[]) => write(KEYS.slates, s);
export const loadDraft = () => read<Draft | null>(KEYS.draft, null);
export const saveDraft = (d: Draft | null) => write(KEYS.draft, d);
