import type { Config, Entity, Mechanic, MarketWindow, Slate, WindowKind } from "../types";
import { WINDOW_KINDS } from "../types";

export interface Candidate {
  key: string;
  mechanicId: string;
  entityId: string;
  secondEntityId: string | null;
  line: number | null;
}

export interface PairCapNote {
  mechanicId: string;
  available: number;
  generated: number;
}

export interface MechanicBreakdown {
  mechanicId: string;
  candidates: number;
  ceilingOk: boolean;
  phaseLive: boolean;
}

export interface PipelineResult {
  candidates: Candidate[];
  eligible: Candidate[];
  droppedByCeiling: number;
  droppedByPhase: number;
  droppedByBoth: number;
  pairCaps: PairCapNote[];
  breakdown: MechanicBreakdown[];
}

export function ceilingCovers(ceiling: WindowKind, kind: WindowKind): boolean {
  return WINDOW_KINDS.indexOf(ceiling) >= WINDOW_KINDS.indexOf(kind);
}

/** Unordered pairs from the same league. Two leagues can always be paired with each other. */
function pairsFrom(pool: Entity[]): [Entity, Entity][] {
  const pairs: [Entity, Entity][] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      const bothLeagues = a.type === "league" && b.type === "league";
      if (bothLeagues || a.league === b.league) pairs.push([a, b]);
    }
  }
  return pairs;
}

/** Step 1: cross product of mechanics, compatible eligible entities and lines. */
export function buildCandidates(config: Config): { candidates: Candidate[]; pairCaps: PairCapNote[] } {
  const candidates: Candidate[] = [];
  const pairCaps: PairCapNote[] = [];

  for (const m of config.mechanics) {
    const pool = config.entities.filter((e) => e.eligible && m.allowedEntityTypes.includes(e.type));
    let groups: [Entity, Entity | null][];
    if (m.entityCount === 2) {
      const all = pairsFrom(pool);
      const capped = all.slice(0, Math.max(0, config.rules.pairCap));
      if (capped.length < all.length) {
        pairCaps.push({ mechanicId: m.id, available: all.length, generated: capped.length });
      }
      groups = capped;
    } else {
      groups = pool.map((e) => [e, null]);
    }
    const lines: (number | null)[] = m.lines.length ? m.lines : [null];
    for (const [a, b] of groups) {
      for (const line of lines) {
        candidates.push({
          key: [m.id, a.id, b?.id ?? "", line ?? ""].join("|"),
          mechanicId: m.id,
          entityId: a.id,
          secondEntityId: b?.id ?? null,
          line,
        });
      }
    }
  }
  return { candidates, pairCaps };
}

/** Step 1 then step 2 (eligibility filter). Nothing else, deliberately. */
export function runPipeline(config: Config, window: MarketWindow): PipelineResult {
  const { candidates, pairCaps } = buildCandidates(config);
  const mechanics = new Map<string, Mechanic>(config.mechanics.map((m) => [m.id, m]));

  const eligible: Candidate[] = [];
  let droppedByCeiling = 0;
  let droppedByPhase = 0;
  let droppedByBoth = 0;

  for (const c of candidates) {
    const m = mechanics.get(c.mechanicId)!;
    const ceilingOk = ceilingCovers(m.windowCeiling, window.kind);
    const phaseLive = config.rules.livePhases.includes(m.phase);
    if (ceilingOk && phaseLive) eligible.push(c);
    if (!ceilingOk) droppedByCeiling++;
    if (!phaseLive) droppedByPhase++;
    if (!ceilingOk && !phaseLive) droppedByBoth++;
  }

  const breakdown = config.mechanics.map((m) => ({
    mechanicId: m.id,
    candidates: candidates.filter((c) => c.mechanicId === m.id).length,
    ceilingOk: ceilingCovers(m.windowCeiling, window.kind),
    phaseLive: config.rules.livePhases.includes(m.phase),
  }));

  return { candidates, eligible, droppedByCeiling, droppedByPhase, droppedByBoth, pairCaps, breakdown };
}

export function droppedSummary(r: PipelineResult, window: MarketWindow): string {
  const dropped = r.candidates.length - r.eligible.length;
  if (dropped === 0) return "Nothing dropped.";
  const parts: string[] = [];
  if (r.droppedByCeiling) parts.push(`${r.droppedByCeiling} because the mechanic's window ceiling cannot cover a ${window.kind} window`);
  if (r.droppedByPhase) parts.push(`${r.droppedByPhase} because the mechanic's phase is not live`);
  const both = r.droppedByBoth ? ` (${r.droppedByBoth} failed both checks)` : "";
  return `Dropped ${dropped}: ${parts.join("; ")}${both}.`;
}

export function createSlate(window: MarketWindow, hook: string, eligible: Candidate[]): Slate {
  const id = `slate-${Date.now().toString(36)}`;
  return {
    id,
    windowId: window.id,
    createdAt: new Date().toISOString(),
    hook: hook.trim(),
    markets: eligible.map((c, i) => ({
      id: `${id}-${i + 1}`,
      mechanicId: c.mechanicId,
      entityId: c.entityId,
      secondEntityId: c.secondEntityId,
      line: c.line,
      windowId: window.id,
      status: "pending",
      yesPrice: null,
      noPrice: null,
      approver: null,
      decidedAt: null,
    })),
  };
}
