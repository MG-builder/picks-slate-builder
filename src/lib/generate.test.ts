import { describe, expect, it } from "vitest";
import { buildCandidates, ceilingCovers, runPipeline } from "./generate";
import { seedConfig } from "./storage";
import type { Config } from "../types";

const cfg = (): Config => seedConfig();
const win = (c: Config, id: string) => c.windows.find((w) => w.id === id)!;

describe("ceilingCovers", () => {
  it("lets a ceiling cover its own kind and narrower ones only", () => {
    expect(ceilingCovers("gameweek", "gameweek")).toBe(true);
    expect(ceilingCovers("gameweek", "fortnight")).toBe(false);
    expect(ceilingCovers("fortnight", "gameweek")).toBe(true);
    expect(ceilingCovers("season", "fortnight")).toBe(true);
  });
});

describe("buildCandidates", () => {
  it("produces one candidate per line, or one when there are no lines", () => {
    const c = cfg();
    const { candidates } = buildCandidates(c);
    const leagues = c.entities.filter((e) => e.type === "league" && e.eligible).length;
    expect(candidates.filter((x) => x.mechanicId === "mech-league-goals-ou")).toHaveLength(leagues * 3);
    expect(candidates.filter((x) => x.mechanicId === "mech-any-hattrick")).toHaveLength(leagues);
  });

  it("skips ineligible entities and incompatible types", () => {
    const { candidates } = buildCandidates(cfg());
    const ids = candidates.flatMap((x) => [x.entityId, x.secondEntityId]);
    expect(ids).not.toContain("tm-new");
    expect(candidates.filter((x) => x.mechanicId === "mech-player-goal-ladder").every((x) => x.entityId.startsWith("pl-"))).toBe(true);
  });

  it("pairs only same-league entities, unordered, and reports the cap", () => {
    const c = cfg();
    c.rules.pairCap = 1000;
    const { candidates, pairCaps } = buildCandidates(c);
    const byId = new Map(c.entities.map((e) => [e.id, e]));
    const pairs = candidates.filter((x) => x.mechanicId === "mech-both-score");
    expect(pairs.every((p) => byId.get(p.entityId)!.league === byId.get(p.secondEntityId!)!.league)).toBe(true);
    const keys = pairs.map((p) => [p.entityId, p.secondEntityId].sort().join("+"));
    expect(new Set(keys).size).toBe(keys.length);
    expect(pairCaps).toHaveLength(0);

    c.rules.pairCap = 2;
    const capped = buildCandidates(c);
    expect(capped.candidates.filter((x) => x.mechanicId === "mech-both-score")).toHaveLength(2);
    expect(capped.pairCaps.find((p) => p.mechanicId === "mech-both-score")).toMatchObject({ generated: 2, available: pairs.length });
  });

  it("pairs two leagues for league vs league", () => {
    const { candidates } = buildCandidates(cfg());
    expect(candidates.filter((x) => x.mechanicId === "mech-league-more-goals")).toHaveLength(1);
  });
});

describe("runPipeline", () => {
  it("drops gameweek mechanics from a fortnight window and non-live phases", () => {
    const c = cfg();
    const r = runPipeline(c, win(c, "win-fn-6-7"));
    const kept = new Set(r.eligible.map((x) => x.mechanicId));
    expect(kept).toEqual(new Set(["mech-team-points-fortnight", "mech-team-vs-team-points", "mech-season-team-points"]));
    expect(r.candidates.length - r.eligible.length).toBe(r.droppedByCeiling + r.droppedByPhase - r.droppedByBoth);
  });

  it("drops phase 3 until it is made live", () => {
    const c = cfg();
    const gw = win(c, "win-gw6");
    expect(runPipeline(c, gw).eligible.some((x) => x.mechanicId === "mech-any-hattrick")).toBe(false);
    c.rules.livePhases = [1, 2, 3];
    expect(runPipeline(c, gw).eligible.some((x) => x.mechanicId === "mech-any-hattrick")).toBe(true);
  });
});
