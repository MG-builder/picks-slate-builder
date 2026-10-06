import { describe, expect, it } from "vitest";
import { buildCandidates, ceilingCovers, createSlate, runPipeline, slateSize } from "./generate";
import { loadConfig, loadDraft, seedConfig } from "./storage";
import { makeLookup, question } from "./format";
import type { Config } from "../types";

const cfg = (): Config => seedConfig();
const win = (c: Config, id: string) => c.windows.find((w) => w.id === id)!;
const names = (c: Config, ids: string[]) => ids.map((id) => c.entities.find((e) => e.id === id)!.name);
const groupsFor = (c: Config, windowId: string, mechanicId: string) =>
  buildCandidates(c, win(c, windowId))
    .candidates.filter((x) => x.mechanicId === mechanicId)
    .map((x) => [x.entityId, ...x.otherEntityIds]);

describe("ceilingCovers", () => {
  it("lets a ceiling cover its own kind and narrower ones only", () => {
    expect(ceilingCovers("gameweek", "gameweek")).toBe(true);
    expect(ceilingCovers("gameweek", "fortnight")).toBe(false);
    expect(ceilingCovers("season", "fortnight")).toBe(true);
  });
});

describe("both players to score, gameweek 6", () => {
  // Scorer pool: Haaland and Semenyo (Man City), Bruno (Man Utd), Joao Pedro (Chelsea),
  // Gyokeres (Arsenal), Isak (Liverpool). 15 pairs, minus Haaland/Semenyo (same team),
  // minus Isak with either City player (Liverpool v Man City this gameweek) = 12.
  it("keeps 12 pairs, all on different teams that do not meet", () => {
    const c = cfg();
    const pairs = groupsFor(c, "win-gw6", "mech-both-score");
    expect(pairs).toHaveLength(12);
    const team = new Map(c.entities.map((e) => [e.id, e.team]));
    for (const [a, b] of pairs) expect(team.get(a)).not.toBe(team.get(b));
    expect(pairs.map((p) => p.join("+"))).not.toContain("pl-haaland+pl-isak");
  });

  it("puts the highest priority pair first", () => {
    const c = cfg();
    expect(names(c, groupsFor(c, "win-gw6", "mech-both-score")[0])).toEqual(["Erling Haaland", "Bruno Fernandes"]);
  });

  it("reports the pairs dropped by the fixture check", () => {
    const c = cfg();
    const { fixtureClashes } = buildCandidates(c, win(c, "win-gw6"));
    expect(fixtureClashes.find((f) => f.mechanicId === "mech-both-score")?.dropped).toBe(2);
  });

  it("allows Haaland with Isak in a week Liverpool and City do not meet", () => {
    const c = cfg();
    const pairs = groupsFor(c, "win-gw7", "mech-both-score").map((p) => p.join("+"));
    expect(pairs).toContain("pl-haaland+pl-isak");
  });
});

describe("all three players to score, gameweek 6", () => {
  // 20 trios, minus 4 with both City players, minus 6 with Isak and one City player = 10.
  it("keeps 10 trios", () => {
    expect(groupsFor(cfg(), "win-gw6", "mech-all-three-score")).toHaveLength(10);
  });
});

describe("A scores, B assists (same team)", () => {
  it("builds ordered scorer and assister pairs on the same team", () => {
    const c = cfg();
    const duos = groupsFor(c, "win-gw6", "mech-teammates-score-assist").map((g) => names(c, g).join(" > "));
    expect(duos.sort()).toEqual(
      [
        "Alexander Isak > Dominik Szoboszlai",
        "Antoine Semenyo > Erling Haaland",
        "Antoine Semenyo > Rayan Cherki",
        "Erling Haaland > Rayan Cherki",
        "João Pedro > Morgan Rogers",
        "Viktor Gyökeres > Martin Ødegaard",
      ].sort(),
    );
  });
});

describe("pools", () => {
  it("never uses untagged players", () => {
    const c = cfg();
    const untagged = new Set(c.entities.filter((e) => e.tags.length === 0).map((e) => e.id));
    const used = buildCandidates(c, win(c, "win-gw6")).candidates.flatMap((x) => [x.entityId, ...x.otherEntityIds]);
    expect(used.some((id) => untagged.has(id))).toBe(false);
  });

  it("reports when the group cap cuts a mechanic", () => {
    const c = cfg();
    c.rules.groupCap = 5;
    const { groupCaps } = buildCandidates(c, win(c, "win-gw6"));
    expect(groupCaps.find((g) => g.mechanicId === "mech-both-score")).toMatchObject({ available: 12, generated: 5 });
  });
});

describe("runPipeline", () => {
  it("puts each ticked mechanic's count on the slate and keeps the rest as reserves", () => {
    const c = cfg();
    const r = runPipeline(c, win(c, "win-gw6"));
    const both = r.breakdown.find((b) => b.mechanicId === "mech-both-score")!;
    const three = r.breakdown.find((b) => b.mechanicId === "mech-all-three-score")!;
    expect([both.onSlate, both.reserves]).toEqual([5, 7]);
    expect([three.onSlate, three.reserves]).toEqual([1, 9]);
    expect(slateSize(r)).toBe(6);
    // The first `count` in config order go on the slate.
    const firstOnSlate = r.selected.find((x) => x.onSlate)!;
    expect(names(c, [firstOnSlate.entityId, ...firstOnSlate.otherEntityIds])).toEqual(["Erling Haaland", "Bruno Fernandes"]);
  });

  it("cuts later mechanics when the slate size is below the counts", () => {
    const c = cfg();
    c.rules.slateSize = 4;
    const r = runPipeline(c, win(c, "win-gw6"));
    const on = (id: string) => r.breakdown.find((b) => b.mechanicId === id)!.onSlate;
    expect([on("mech-both-score"), on("mech-all-three-score")]).toEqual([4, 0]);
    expect(slateSize(r)).toBe(4);
  });

  it("tops up in turn from ticked mechanics when the slate size is above the counts", () => {
    const c = cfg();
    c.rules.slateSize = 9;
    const r = runPipeline(c, win(c, "win-gw6"));
    const on = (id: string) => r.breakdown.find((b) => b.mechanicId === id)!.onSlate;
    // Counts give 5 + 1; three more, one from each mechanic in turn: both, three, both.
    expect([on("mech-both-score"), on("mech-all-three-score")]).toEqual([7, 2]);
    expect(slateSize(r)).toBe(9);
  });

  it("stops short when not enough markets are possible", () => {
    const c = cfg();
    c.rules.slateSize = 100;
    expect(slateSize(runPipeline(c, win(c, "win-gw6")))).toBe(22);
  });

  it("never tops up from a mechanic with a count of 0", () => {
    const c = cfg();
    c.rules.slateSize = 10;
    c.mechanics.find((m) => m.id === "mech-all-three-score")!.count = 0;
    const r = runPipeline(c, win(c, "win-gw6"));
    expect(r.breakdown.find((b) => b.mechanicId === "mech-all-three-score")!.onSlate).toBe(0);
    expect(r.breakdown.find((b) => b.mechanicId === "mech-both-score")!.onSlate).toBe(10);
  });

  it("skips unticked mechanics", () => {
    const c = cfg();
    const r = runPipeline(c, win(c, "win-gw6"));
    expect(new Set(r.selected.map((x) => x.mechanicId))).toEqual(new Set(["mech-both-score", "mech-all-three-score"]));
    c.mechanics.find((m) => m.id === "mech-teammates-score-assist")!.enabled = true;
    c.rules.slateSize = 8;
    const ticked = runPipeline(c, win(c, "win-gw6"));
    expect(ticked.breakdown.find((b) => b.mechanicId === "mech-teammates-score-assist")!.onSlate).toBe(2);
  });

  it("puts everything in reserves when a count is 0", () => {
    const c = cfg();
    c.mechanics.find((m) => m.id === "mech-all-three-score")!.count = 0;
    const b = runPipeline(c, win(c, "win-gw6")).breakdown.find((x) => x.mechanicId === "mech-all-three-score")!;
    expect([b.onSlate, b.reserves]).toEqual([0, 10]);
  });

  it("drops every gameweek mechanic from a fortnight window", () => {
    const c = cfg();
    const r = runPipeline(c, win(c, "win-fn-6-7"));
    expect(r.selected).toHaveLength(0);
    expect(r.droppedByCeiling).toBe(r.candidates.length);
  });

  it("marks slate and reserve markets on the created slate", () => {
    const c = cfg();
    const slate = createSlate(win(c, "win-gw6"), "hook", runPipeline(c, win(c, "win-gw6")).selected);
    expect(slate.markets.filter((m) => m.onSlate)).toHaveLength(6);
    expect(slate.markets).toHaveLength(22);
    expect(slate.publishedAt).toBeNull();
  });
});

describe("question text", () => {
  it("fills {all} for three players", () => {
    const q = question(makeLookup(cfg()), {
      id: "m", mechanicId: "mech-all-three-score", entityId: "pl-haaland", otherEntityIds: ["pl-bruno", "pl-gyokeres"],
      line: null, windowId: "win-gw6", status: "pending", yesPrice: null, noPrice: null, approver: null, decidedAt: null,
      onSlate: true,
    });
    expect(q).toBe("Will Erling Haaland, Bruno Fernandes and Viktor Gyökeres all score in Gameweek 6?");
  });
});

describe("storage migration", () => {
  it("removes the retired cross-match A scores, B assists mechanic", () => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    const saved = cfg();
    saved.mechanics.push({ ...saved.mechanics[0], id: "mech-cross-score-assist", groupRule: "different-teams" });
    store.set("psb.v1.config", JSON.stringify(saved));
    expect(loadConfig().mechanics.map((m) => m.id)).not.toContain("mech-cross-score-assist");
  });

  it("only ever pairs a scorer and assister from the same team", () => {
    const c = cfg();
    c.mechanics.forEach((m) => (m.enabled = true));
    const team = new Map(c.entities.map((e) => [e.id, e.team]));
    const assistMechanics = c.mechanics.filter((m) => m.slots.includes("scorer") && m.slots.includes("assister"));
    expect(assistMechanics.every((m) => m.groupRule === "same-team")).toBe(true);
    for (const m of assistMechanics) {
      for (const [a, b] of groupsFor(c, "win-gw7", m.id)) expect(team.get(a)).toBe(team.get(b));
    }
  });

  it("replaces pre-slot config with the seed and upgrades old slates", () => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    const old = cfg() as unknown as Record<string, any>;
    old.mechanics = old.mechanics.map(({ slots: _s, ...m }: Record<string, unknown>) => ({ ...m, entityCount: 2 }));
    store.set("psb.v1.config", JSON.stringify(old));
    const market = { id: "m1", mechanicId: "mech-both-score", entityId: "pl-haaland", secondEntityId: "pl-isak" };
    store.set("psb.v1.draft", JSON.stringify({ readOnly: false, dirty: false, slate: { id: "s1", markets: [market] } }));

    expect(loadConfig()).toEqual(seedConfig());
    const draft = loadDraft()!;
    expect(draft.slate.markets[0].otherEntityIds).toEqual(["pl-isak"]);
    expect(draft.slate.markets[0].onSlate).toBe(true);
    expect(draft.slate.publishedAt).toBeNull();
  });

  it("turns phases into tick boxes: ticked if the phase was live", () => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    const old = cfg() as unknown as Record<string, any>;
    const phases: Record<string, number> = { "mech-both-score": 1, "mech-all-three-score": 1, "mech-teammates-score-assist": 3 };
    old.mechanics = old.mechanics.map(({ enabled: _e, count: _c, ...m }: Record<string, any>) => ({ ...m, phase: phases[m.id] ?? 2 }));
    old.rules = { slateSize: 6, livePhases: [1, 3], groupCap: 25 };
    store.set("psb.v1.config", JSON.stringify(old));

    const c = loadConfig();
    const ticked = c.mechanics.filter((m) => m.enabled).map((m) => m.id);
    expect(ticked).toEqual(["mech-both-score", "mech-all-three-score", "mech-teammates-score-assist"]);
    expect(c.mechanics.find((m) => m.id === "mech-both-score")!.count).toBe(5);
    expect(c.rules).toEqual({ slateSize: 6, groupCap: 25 });
    expect(c.mechanics.some((m) => "phase" in m)).toBe(false);
  });
});
