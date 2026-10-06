import type { Config, Entity, Mechanic, MarketWindow, SlateMarket } from "../types";

export interface Lookup {
  mechanic: (id: string) => Mechanic | undefined;
  entity: (id: string | null) => Entity | undefined;
  window: (id: string) => MarketWindow | undefined;
}

export function makeLookup(config: Config): Lookup {
  const m = new Map(config.mechanics.map((x) => [x.id, x]));
  const e = new Map(config.entities.map((x) => [x.id, x]));
  const w = new Map(config.windows.map((x) => [x.id, x]));
  return {
    mechanic: (id) => m.get(id),
    entity: (id) => (id ? e.get(id) : undefined),
    window: (id) => w.get(id),
  };
}

/** Slates reference config by id, so a later config deletion shows up as a missing reference. */
export const missing = (id: string) => `[missing: ${id}]`;

export function entityName(lk: Lookup, id: string | null): string {
  if (!id) return "";
  return lk.entity(id)?.name ?? missing(id);
}

export function entitiesLabel(lk: Lookup, m: SlateMarket): string {
  return [m.entityId, ...m.otherEntityIds].map((id) => entityName(lk, id)).join(" / ");
}

export function question(lk: Lookup, m: SlateMarket): string {
  const mech = lk.mechanic(m.mechanicId);
  if (!mech) return missing(m.mechanicId);
  const names = [m.entityId, ...m.otherEntityIds].map((id) => entityName(lk, id));
  const list = (word: string) =>
    names.length > 1 ? `${names.slice(0, -1).join(", ")} ${word} ${names[names.length - 1]}` : names[0];
  return mech.questionShape
    .replaceAll("{all}", list("and"))
    .replaceAll("{any}", list("or"))
    .replaceAll("{a}", names[0] ?? "")
    .replaceAll("{b}", names[1] ?? "")
    .replaceAll("{c}", names[2] ?? "")
    .replaceAll("{d}", names[3] ?? "")
    .replaceAll("{line}", m.line == null ? "" : String(m.line))
    .replaceAll("{window}", lk.window(m.windowId)?.label ?? missing(m.windowId));
}

export function fmtDateTime(iso: string | null, utc = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(utc ? { timeZone: "UTC", timeZoneName: "short" } : {}),
  });
}

/** Parses a price. Only rule: a positive number. Returns null otherwise. */
export function parsePrice(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const isPositive = (n: number | null): n is number => n != null && Number.isFinite(n) && n > 0;
