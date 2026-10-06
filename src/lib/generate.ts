import type { Config, Entity, GroupRule, Mechanic, MarketWindow, Slate, WindowKind } from "../types";
import { ANY_TAG, WINDOW_KINDS } from "../types";

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

export interface FixtureClashNote {
  mechanicId: string;
  dropped: number;
}

export interface MechanicBreakdown {
  mechanicId: string;
  /** Candidates built for this mechanic and window, before the filter. */
  candidates: number;
  /** The window's kind is between the mechanic's floor and ceiling. */
  windowOk: boolean;
  enabled: boolean;
  /** Markets that go on the slate: the first `count` that pass the filter. */
  onSlate: number;
  /** Markets that pass the filter but exceed `count`, kept for swapping in. */
  reserves: number;
}

export interface SelectedCandidate extends Candidate {
  onSlate: boolean;
}

export interface PipelineResult {
  candidates: Candidate[];
  /** Candidates that pass the filter, each marked as on the slate or a reserve. */
  selected: SelectedCandidate[];
  droppedByWindow: number;
  droppedByDisabled: number;
  groupCaps: GroupCapNote[];
  fixtureClashes: FixtureClashNote[];
  breakdown: MechanicBreakdown[];
}

export function ceilingCovers(ceiling: WindowKind, kind: WindowKind): boolean {
  return WINDOW_KINDS.indexOf(ceiling) >= WINDOW_KINDS.indexOf(kind);
}

/** The window kind is between the mechanic's floor and ceiling, inclusive. */
export function windowFits(m: Pick<Mechanic, "windowFloor" | "windowCeiling">, kind: WindowKind): boolean {
  return ceilingCovers(m.windowCeiling, kind) && ceilingCovers(kind, m.windowFloor);
}

const hasTag = (e: Entity, tag: string) => tag === ANY_TAG || e.tags.includes(tag);

/** Teams that play each other in the window, as "A|B" keys in both orders. */
function fixturePairs(window: MarketWindow): Set<string> {
  const pairs = new Set<string>();
  for (const f of window.fixtures) {
    const [home, away] = f.split(/\s+v\s+/i).map((t) => t.trim());
    if (home && away) {
      pairs.add(`${home}|${away}`);
      pairs.add(`${away}|${home}`);
    }
  }
  return pairs;
}

type GroupCheck = "ok" | "rule" | "fixture";

function checkGroup(group: Entity[], rule: GroupRule, meetings: Set<string>): GroupCheck {
  if (group.length < 2) return "ok";
  if (rule === "same-league") {
    const allLeagues = group.every((e) => e.type === "league");
    return allLeagues || group.every((e) => e.league === group[0].league) ? "ok" : "rule";
  }
  if (rule === "same-team") {
    return group[0].team && group.every((e) => e.team === group[0].team) ? "ok" : "rule";
  }
  // different-teams
  const teams = group.map((e) => e.team);
  if (teams.some((t) => !t) || new Set(teams).size !== teams.length) return "rule";
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      if (meetings.has(`${teams[i]}|${teams[j]}`)) return "fixture";
    }
  }
  return "ok";
}

/**
 * Every way to fill the mechanic's slots from the pool.
 * Identical slots give unordered groups (combinations); otherwise each slot is a role
 * and the order matters, though one entity never fills two slots.
 */
function fillSlots(pool: Entity[], slots: string[]): Entity[][] {
  const out: Entity[][] = [];
  const unordered = slots.every((t) => t === slots[0]);
  const pick = (slot: number, start: number, acc: Entity[]) => {
    if (slot === slots.length) {
      out.push(acc);
      return;
    }
    for (let i = unordered ? start : 0; i < pool.length; i++) {
      const e = pool[i];
      if (acc.includes(e) || !hasTag(e, slots[slot])) continue;
      pick(slot + 1, i + 1, [...acc, e]);
    }
  };
  pick(0, 0, []);
  return out;
}

/** Step 1: cross product of mechanics, compatible eligible entities and lines. */
export function buildCandidates(
  config: Config,
  window: MarketWindow,
): { candidates: Candidate[]; groupCaps: GroupCapNote[]; fixtureClashes: FixtureClashNote[] } {
  const candidates: Candidate[] = [];
  const groupCaps: GroupCapNote[] = [];
  const fixtureClashes: FixtureClashNote[] = [];
  const meetings = fixturePairs(window);

  for (const m of config.mechanics) {
    const pool = config.entities.filter(
      (e) =>
        e.eligible &&
        m.allowedEntityTypes.includes(e.type) &&
        (m.leagues.length === 0 || m.leagues.includes(e.league)),
    );
    const valid: Entity[][] = [];
    let clashes = 0;
    for (const group of fillSlots(pool, m.slots)) {
      const result = checkGroup(group, m.groupRule, meetings);
      if (result === "ok") valid.push(group);
      if (result === "fixture") clashes++;
    }
    if (clashes) fixtureClashes.push({ mechanicId: m.id, dropped: clashes });

    let groups = valid;
    if (m.slots.length > 1) {
      groups = valid.slice(0, Math.max(0, config.rules.groupCap));
      if (groups.length < valid.length) {
        groupCaps.push({ mechanicId: m.id, available: valid.length, generated: groups.length });
      }
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
  return { candidates, groupCaps, fixtureClashes };
}

/**
 * Step 1, then step 2 (eligibility filter: window floor and ceiling, and the mechanic's tick box),
 * then the slate is chosen, in config order:
 * 1. each ticked mechanic gets up to its `count`, until the slate size is reached;
 * 2. if there is still room, the slate is topped up one market at a time from each ticked
 *    mechanic in turn (mechanics with a count of 0 are left out).
 * Everything else that passed the filter is a reserve.
 */
export function runPipeline(config: Config, window: MarketWindow): PipelineResult {
  const { candidates, groupCaps, fixtureClashes } = buildCandidates(config, window);
  const mechanics = new Map<string, Mechanic>(config.mechanics.map((m) => [m.id, m]));
  const target = Math.max(0, config.rules.slateSize);

  const passed: Candidate[] = [];
  let droppedByWindow = 0;
  let droppedByDisabled = 0;
  for (const c of candidates) {
    const m = mechanics.get(c.mechanicId)!;
    if (!windowFits(m, window.kind)) droppedByWindow++;
    else if (!m.enabled) droppedByDisabled++;
    else passed.push(c);
  }

  const queues = config.mechanics.map((m) => ({ m, queue: passed.filter((c) => c.mechanicId === m.id) }));
  const chosen = new Set<string>();
  const next = new Map(queues.map(({ m }) => [m.id, 0]));
  const take = (mechanicId: string, queue: Candidate[]) => {
    const i = next.get(mechanicId)!;
    if (i >= queue.length || chosen.size >= target) return false;
    chosen.add(queue[i].key);
    next.set(mechanicId, i + 1);
    return true;
  };
  for (const { m, queue } of queues) {
    for (let k = 0; k < Math.max(0, m.count); k++) if (!take(m.id, queue)) break;
  }
  let progress = true;
  while (chosen.size < target && progress) {
    progress = false;
    for (const { m, queue } of queues) {
      if (m.count > 0 && take(m.id, queue)) progress = true;
    }
  }

  const selected: SelectedCandidate[] = passed.map((c) => ({ ...c, onSlate: chosen.has(c.key) }));

  const breakdown = config.mechanics.map((m) => {
    const mine = selected.filter((c) => c.mechanicId === m.id);
    return {
      mechanicId: m.id,
      candidates: candidates.filter((c) => c.mechanicId === m.id).length,
      windowOk: windowFits(m, window.kind),
      enabled: m.enabled,
      onSlate: mine.filter((c) => c.onSlate).length,
      reserves: mine.filter((c) => !c.onSlate).length,
    };
  });

  return { candidates, selected, droppedByWindow, droppedByDisabled, groupCaps, fixtureClashes, breakdown };
}

export const slateSize = (r: PipelineResult) => r.selected.filter((c) => c.onSlate).length;

export function createSlate(window: MarketWindow, hook: string, selected: SelectedCandidate[]): Slate {
  const id = `slate-${Date.now().toString(36)}`;
  return {
    id,
    windowId: window.id,
    createdAt: new Date().toISOString(),
    hook: hook.trim(),
    publishedAt: null,
    markets: selected.map((c, i) => ({
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
      onSlate: c.onSlate,
    })),
  };
}
