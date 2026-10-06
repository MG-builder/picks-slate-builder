import { useMemo, useState } from "react";
import type { Config, Entity, EntityType, GroupRule, Mechanic, MarketWindow, WindowKind } from "../types";
import { ANY_TAG, ENTITY_TYPES, GROUP_RULES, WINDOW_KINDS } from "../types";
import { runPipeline } from "../lib/generate";
import SlatePreview from "../components/SlatePreview";
import { seedConfig } from "../lib/storage";
import { CommitInput, joinList, splitList, splitNumbers } from "../components/inputs";

type Section = "mechanics" | "entities" | "windows" | "rules";

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

function replaceAt<T>(xs: T[], i: number, patch: Partial<T>): T[] {
  return xs.map((x, j) => (j === i ? { ...x, ...patch } : x));
}

function DeleteButton(props: { label: string; onDelete: () => void }) {
  return (
    <button
      className="no"
      onClick={() => window.confirm(`Delete ${props.label}?`) && props.onDelete()}
    >
      Delete
    </button>
  );
}

/** ISO string <-> datetime-local value, treated as UTC. */
const toLocalInput = (iso: string) => iso.slice(0, 16);
const fromLocalInput = (v: string) => (v ? `${v}:00Z` : "");

export default function ConfigScreen(props: {
  config: Config;
  onChange: (c: Config) => void;
  windowId: string;
  onWindowChange: (id: string) => void;
}) {
  const { config, onChange } = props;
  const [section, setSection] = useState<Section>("mechanics");
  const previewWindow = config.windows.find((w) => w.id === props.windowId) ?? config.windows[0];
  const preview = useMemo(
    () => (previewWindow ? runPipeline(config, previewWindow) : null),
    [config, previewWindow],
  );

  const setMechanics = (mechanics: Mechanic[]) => onChange({ ...config, mechanics });
  const setEntities = (entities: Entity[]) => onChange({ ...config, entities });
  const setWindows = (windows: MarketWindow[]) => onChange({ ...config, windows });

  return (
    <section>
      <div className="review-head">
        <h2>Config</h2>
        <button
          onClick={() =>
            window.confirm("Reset all config to the seed data? Saved slates are kept.") && onChange(seedConfig())
          }
        >
          Reset to seed data
        </button>
      </div>
      <p className="muted">
        Set up mechanics, players and windows here, then Generate. Changes save immediately. Existing slates are not
        regenerated.
      </p>

      {previewWindow && preview && (
        <div className="preview-strip">
          <label>
            Preview for{" "}
            <select value={previewWindow.id} onChange={(e) => props.onWindowChange(e.target.value)}>
              {config.windows.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </label>
          <SlatePreview config={config} window={previewWindow} result={preview} compact />
        </div>
      )}
      <div className="subtabs">
        {(["mechanics", "entities", "windows", "rules"] as Section[]).map((s) => (
          <button key={s} className={section === s ? "tab active" : "tab"} onClick={() => setSection(s)}>
            {s[0].toUpperCase() + s.slice(1)}
            {s !== "rules" && <span className="muted"> ({config[s].length})</span>}
          </button>
        ))}
      </div>

      {section === "mechanics" && (
        <>
          <div className="table-wrap">
            <table className="grid edit">
              <thead>
                <tr>
                  <th title="Ticked mechanics are generated">Use</th>
                  <th title="Markets of this mechanic on the slate; the rest become reserves">Count</th>
                  <th>ID</th><th>Name</th><th>Question shape</th><th>Entity types</th><th>Slots</th><th>Group rule</th><th>Leagues</th>
                  <th>Source market</th><th>Ceiling</th><th>Tie rule</th><th>Lines</th>
                  <th>Metric</th><th>Operator</th><th />
                </tr>
              </thead>
              <tbody>
                {config.mechanics.map((m, i) => {
                  const set = (p: Partial<Mechanic>) => setMechanics(replaceAt(config.mechanics, i, p));
                  return (
                    <tr key={m.id} className={m.enabled ? "" : "dim"}>
                      <td className="center">
                        <input type="checkbox" aria-label={`Use ${m.name}`} checked={m.enabled}
                          onChange={(e) => set({ enabled: e.target.checked })} />
                      </td>
                      <td>
                        <CommitInput className="tiny-num" value={String(m.count)}
                          onCommit={(t) => {
                            const n = parseInt(t, 10);
                            if (Number.isFinite(n) && n >= 0) set({ count: n });
                          }} />
                      </td>
                      <td className="mono muted">{m.id}</td>
                      <td><input value={m.name} onChange={(e) => set({ name: e.target.value })} /></td>
                      <td>
                        <input className="wide" value={m.questionShape} title="Placeholders: {a} {b} {c} {d} (one per slot), {all}, {line}, {window}"
                          onChange={(e) => set({ questionShape: e.target.value })} />
                      </td>
                      <td className="nowrap">
                        {ENTITY_TYPES.map((t) => (
                          <label key={t} className="check">
                            <input
                              type="checkbox"
                              checked={m.allowedEntityTypes.includes(t)}
                              onChange={(e) =>
                                set({
                                  allowedEntityTypes: e.target.checked
                                    ? ENTITY_TYPES.filter((x) => x === t || m.allowedEntityTypes.includes(x))
                                    : m.allowedEntityTypes.filter((x) => x !== t),
                                })
                              }
                            />
                            {t}
                          </label>
                        ))}
                      </td>
                      <td>
                        <CommitInput value={joinList(m.slots)}
                          title={`One entity tag per entity in the market, e.g. scorer, assister. ${ANY_TAG} means any entity.`}
                          onCommit={(t) => {
                            const slots = splitList(t);
                            if (slots.length) set({ slots });
                          }} />
                      </td>
                      <td>
                        <select value={m.groupRule} disabled={m.slots.length < 2}
                          onChange={(e) => set({ groupRule: e.target.value as GroupRule })}>
                          {GROUP_RULES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <CommitInput value={joinList(m.leagues)} placeholder="any"
                          title="Comma separated league names. Empty means any league."
                          onCommit={(t) => set({ leagues: splitList(t) })} />
                      </td>
                      <td><input value={m.sourceMarket} onChange={(e) => set({ sourceMarket: e.target.value })} /></td>
                      <td>
                        <select value={m.windowCeiling} onChange={(e) => set({ windowCeiling: e.target.value as WindowKind })}>
                          {WINDOW_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </td>
                      <td><input value={m.tieRule} onChange={(e) => set({ tieRule: e.target.value })} /></td>
                      <td>
                        <CommitInput className="short" value={joinList(m.lines)} placeholder="none"
                          title="Comma separated, e.g. 2, 3. Empty for non-ladder mechanics."
                          onCommit={(t) => set({ lines: splitNumbers(t) })} />
                      </td>
                      <td><input className="short" value={m.metric} onChange={(e) => set({ metric: e.target.value })} /></td>
                      <td><input className="short" value={m.operator} onChange={(e) => set({ operator: e.target.value })} /></td>
                      <td>
                        <DeleteButton label={m.name || m.id}
                          onDelete={() => setMechanics(config.mechanics.filter((_, j) => j !== i))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() =>
              setMechanics([
                ...config.mechanics,
                {
                  id: newId("mech"), name: "New mechanic", questionShape: "", allowedEntityTypes: [],
                  slots: [ANY_TAG], groupRule: GROUP_RULES[0], leagues: [], sourceMarket: "", windowCeiling: WINDOW_KINDS[0], tieRule: "",
                  enabled: false, count: 1, lines: [], metric: "", operator: "",
                },
              ])
            }
          >
            Add mechanic
          </button>
        </>
      )}

      {section === "entities" && (
        <>
          <div className="table-wrap">
            <table className="grid edit">
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Type</th><th>League</th><th>Team</th><th>Feed ID</th>
                  <th>Country relevance</th><th>Tags</th><th>Eligible</th><th />
                </tr>
              </thead>
              <tbody>
                {config.entities.map((e, i) => {
                  const set = (p: Partial<Entity>) => setEntities(replaceAt(config.entities, i, p));
                  return (
                    <tr key={e.id} className={e.eligible ? "" : "dim"}>
                      <td className="mono muted">{e.id}</td>
                      <td><input value={e.name} onChange={(ev) => set({ name: ev.target.value })} /></td>
                      <td>
                        <select value={e.type} onChange={(ev) => set({ type: ev.target.value as EntityType })}>
                          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td><input value={e.league} onChange={(ev) => set({ league: ev.target.value })} /></td>
                      <td><input value={e.team} onChange={(ev) => set({ team: ev.target.value })} /></td>
                      <td><input className="mono" value={e.feedId} onChange={(ev) => set({ feedId: ev.target.value })} /></td>
                      <td>
                        <CommitInput value={joinList(e.countryRelevance)} placeholder="e.g. Nigeria, Ghana"
                          onCommit={(t) => set({ countryRelevance: splitList(t) })} />
                      </td>
                      <td>
                        <CommitInput value={joinList(e.tags)} placeholder="no pool"
                          title="Pools this entity is in, matched against mechanic slots"
                          onCommit={(t) => set({ tags: splitList(t) })} />
                      </td>
                      <td className="center">
                        <input type="checkbox" checked={e.eligible} onChange={(ev) => set({ eligible: ev.target.checked })} />
                      </td>
                      <td>
                        <DeleteButton label={e.name || e.id}
                          onDelete={() => setEntities(config.entities.filter((_, j) => j !== i))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() =>
              setEntities([
                ...config.entities,
                { id: newId("ent"), name: "New entity", type: ENTITY_TYPES[0], league: "", team: "", feedId: "", countryRelevance: [], tags: [], eligible: true },
              ])
            }
          >
            Add entity
          </button>
        </>
      )}

      {section === "windows" && (
        <>
          <div className="table-wrap">
            <table className="grid edit">
              <thead>
                <tr>
                  <th>ID</th><th>Label</th><th>Kind</th><th>Round IDs</th><th>Fixtures</th><th>Opens (UTC)</th><th>Closes (UTC)</th><th />
                </tr>
              </thead>
              <tbody>
                {config.windows.map((w, i) => {
                  const set = (p: Partial<MarketWindow>) => setWindows(replaceAt(config.windows, i, p));
                  return (
                    <tr key={w.id}>
                      <td className="mono muted">{w.id}</td>
                      <td><input value={w.label} onChange={(e) => set({ label: e.target.value })} /></td>
                      <td>
                        <select value={w.kind} onChange={(e) => set({ kind: e.target.value as WindowKind })}>
                          {WINDOW_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </td>
                      <td>
                        <CommitInput className="wide" value={joinList(w.roundIds)} title={joinList(w.roundIds)}
                          onCommit={(t) => set({ roundIds: splitList(t) })} />
                      </td>
                      <td>
                        <CommitInput className="wide" value={joinList(w.fixtures)} placeholder="Home v Away, ..."
                          title={w.fixtures.join("\n")}
                          onCommit={(t) => set({ fixtures: splitList(t) })} />
                      </td>
                      <td>
                        <input type="datetime-local" value={toLocalInput(w.opensAt)}
                          onChange={(e) => set({ opensAt: fromLocalInput(e.target.value) })} />
                      </td>
                      <td>
                        <input type="datetime-local" value={toLocalInput(w.closesAt)}
                          onChange={(e) => set({ closesAt: fromLocalInput(e.target.value) })} />
                      </td>
                      <td>
                        <DeleteButton label={w.label || w.id}
                          onDelete={() => setWindows(config.windows.filter((_, j) => j !== i))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() =>
              setWindows([
                ...config.windows,
                { id: newId("win"), label: "New window", kind: WINDOW_KINDS[0], roundIds: [], fixtures: [], opensAt: "", closesAt: "" },
              ])
            }
          >
            Add window
          </button>
        </>
      )}

      {section === "rules" && (
        <table className="grid edit rules">
          <tbody>
            <tr>
              <th>Max candidates per mechanic</th>
              <td>
                <CommitInput className="short" value={String(config.rules.groupCap)}
                  onCommit={(t) => {
                    const n = parseInt(t, 10);
                    if (Number.isFinite(n) && n >= 0) onChange({ ...config, rules: { ...config.rules, groupCap: n } });
                  }} />
              </td>
              <td className="muted">
                Caps slate plus reserves for each multi-player mechanic, in config order. Generate reports any left out.
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
