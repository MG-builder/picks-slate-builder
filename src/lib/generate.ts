import type { Config, Entity, Mechanic, MarketWindow, Slate, WindowKind } from "../types";
import { WINDOW_KINDS } from "../types";

export interface Candidate {
  key: string;
  mechanicId: string;
  entityId: string;
  otherEntityIds: string[];
  line: number | null;
}

export interface GroupCapNote {
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
  groupCaps: GroupCapNote[];
  breakdown: MechanicBreakdown[];
}

export function ceilingCovers(ceiling: WindowKind, kind: WindowKind): boolean {
  return WINDOW_KINDS.indexOf(ceiling) >= WINDOW_KINDS.indexOf(kind);
}

/**
 * Unordered groups of `size` entities, all from the same league.
 * Leagues are the exception: a group made only of leagues can always be formed.
 */
function groupsFrom(pool: Entity[], size: number): Entity[][] {
  const groups: Entity[][] = [];
  const pick = (start: number, acc: Entity[]) => {
    if (acc.length === size) {
      const allLeagues = acc.every((e) => e.type === "league");
      if (allLeagues || acc.every((e) => e.league === acc[0].league)) groups.push(acc);
      return;
    }
    for (let i = start; i < pool.length; i++) pick(i + 1, [...acc, pool[i]]);
  };
  pick(0, []);
  return groups;
}

/** Step 1: cross product of mechanics, compatible eligible entities and lines. */
export function buildCandidates(config: Config): { candidates: Candidate[]; groupCaps: GroupCapNote[] } {
  const candidates: Candidate[] = [];
  const groupCaps: GroupCapNote[] = [];

  for (const m of config.mechanics) {
    const pool = config.entities.filter(
      (e) =>
        e.eligible &&
        m.allowedEntityTypes.includes(e.type) &&
        (m.leagues.length === 0 || m.leagues.includes(e.league)),
    );
    let groups: Entity[][];
    if (m.entityCount > 1) {
      const all = groupsFrom(pool, m.entityCount);
      const capped = all.slice(0, Math.max(0, config.rules.groupCap));
      if (capped.length < all.length) {
        groupCaps.push({ mechanicId: m.id, available: all.length, generated: capped.length });
      }
      groups = capped;
    } else {
      groups = pool.map((e) => [e]);
    }
    const lines: (number | null)[] = m.lines.length ? m.lines : [null];
    for (const [a, ...others] of groups) {
      for (const line of lines) {
        candidates.push({
          key: [m.id, a.id, ...others.map((o) => o.id), line ?? ""].join("|"),
          mechanicId: m.id,
          entityId: a.id,
          otherEntityIds: others.map((o) => o.id),
          line,
        });
      }
    }
  }
  return { candidates, groupCaps };
}

/** Step 1 then step 2 (eligibility filter). Nothing else, deliberately. */
export function runPipeline(config: Config, window: MarketWindow): PipelineResult {
  const { candidates, groupCaps } = buildCandidates(config);
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

  return { candidates, eligible, droppedByCeiling, droppedByPhase, droppedByBoth, groupCaps, breakdown };
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
      otherEntityIds: c.otherEntityIds,
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
