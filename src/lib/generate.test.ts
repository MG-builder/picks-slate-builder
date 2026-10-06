import { describe, expect, it } from "vitest";
import { buildCandidates, ceilingCovers, runPipeline } from "./generate";
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

describe("teammates: A scores, B assists", () => {
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
  it("keeps only phase 1 markets by default", () => {
    const c = cfg();
    const r = runPipeline(c, win(c, "win-gw6"));
    expect(new Set(r.eligible.map((x) => x.mechanicId))).toEqual(new Set(["mech-both-score", "mech-all-three-score"]));
    expect(r.eligible).toHaveLength(22);
  });

  it("drops every gameweek mechanic from a fortnight window", () => {
    const c = cfg();
    const r = runPipeline(c, win(c, "win-fn-6-7"));
    expect(r.eligible).toHaveLength(0);
    expect(r.droppedByCeiling).toBe(r.candidates.length);
  });
});

describe("question text", () => {
  it("fills {all} for three players", () => {
    const q = question(makeLookup(cfg()), {
      id: "m", mechanicId: "mech-all-three-score", entityId: "pl-haaland", otherEntityIds: ["pl-bruno", "pl-gyokeres"],
      line: null, windowId: "win-gw6", status: "pending", yesPrice: null, noPrice: null, approver: null, decidedAt: null,
    });
    expect(q).toBe("Will Erling Haaland, Bruno Fernandes and Viktor Gyökeres all score in Gameweek 6?");
  });
});

describe("storage migration", () => {
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
    expect(loadDraft()!.slate.markets[0].otherEntityIds).toEqual(["pl-isak"]);
  });
});
