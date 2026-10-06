import { useMemo, useState } from "react";
import type { Config, MarketStatus, SlateMarket } from "../types";
import type { Draft } from "../lib/storage";
import { type Lookup, entitiesLabel, fmtDateTime, isPositive, makeLookup, missing, question } from "../lib/format";
import { PriceInput } from "../components/inputs";

type StatusFilter = "all" | MarketStatus;

function approvalProblem(m: SlateMarket): string | null {
  const missingBits = [
    !isPositive(m.yesPrice) && "Yes price",
    !isPositive(m.noPrice) && "No price",
    !m.approver?.trim() && "approver name",
  ].filter(Boolean);
  return missingBits.length ? `Cannot approve: needs ${missingBits.join(", ")}.` : null;
}

/** Swap picker: reserves of the same mechanic first, then every other reserve by mechanic. */
function SwapSelect(props: { market: SlateMarket; reserves: SlateMarket[]; lk: Lookup; onSwap: (id: string) => void }) {
  const { market, reserves, lk } = props;
  if (!reserves.length) return <span className="muted tiny">no reserves</span>;
  const byMechanic = new Map<string, SlateMarket[]>();
  for (const r of reserves) byMechanic.set(r.mechanicId, [...(byMechanic.get(r.mechanicId) ?? []), r]);
  const order = [market.mechanicId, ...[...byMechanic.keys()].filter((id) => id !== market.mechanicId)];
  return (
    <select
      className="swap"
      value=""
      aria-label="Swap for a reserve"
      onChange={(e) => e.target.value && props.onSwap(e.target.value)}
    >
      <option value="">Swap for...</option>
      {order
        .filter((id) => byMechanic.has(id))
        .map((id) => (
          <optgroup key={id} label={`${lk.mechanic(id)?.name ?? missing(id)}${id === market.mechanicId ? " (same)" : ""}`}>
            {byMechanic.get(id)!.map((r) => (
              <option key={r.id} value={r.id}>{entitiesLabel(lk, r)}{r.line != null ? ` (${r.line})` : ""}</option>
            ))}
          </optgroup>
        ))}
    </select>
  );
}

export default function ReviewScreen(props: {
  config: Config;
  draft: Draft | null;
  onChange: (slate: Draft["slate"]) => void;
  onSave: () => void;
  onReopen: () => void;
  onGoGenerate: () => void;
  onRegenerate: () => void;
}) {
  const { config, draft } = props;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mechFilter, setMechFilter] = useState("");
  const [search, setSearch] = useState("");
  const [bulkApprover, setBulkApprover] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [showReserves, setShowReserves] = useState(false);
  const lk = makeLookup(config);

  const markets = draft?.slate.markets ?? [];
  const onSlate = markets.filter((m) => m.onSlate);
  const reserves = markets.filter((m) => !m.onSlate);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return onSlate.filter(
      (m) =>
        (statusFilter === "all" || m.status === statusFilter) &&
        (!mechFilter || m.mechanicId === mechFilter) &&
        (!q || `${entitiesLabel(lk, m)} ${lk.mechanic(m.mechanicId)?.name ?? ""}`.toLowerCase().includes(q)),
    );
    // lk is rebuilt each render from config; config is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, statusFilter, mechFilter, search, config]);

  if (!draft) {
    return (
      <p className="empty">
        No slate open. <button className="link" onClick={props.onGoGenerate}>Generate one</button> or open one
        from History.
      </p>
    );
  }

  const { slate, readOnly } = draft;
  const stale = markets.filter(
    (m) =>
      !lk.mechanic(m.mechanicId) ||
      !lk.window(m.windowId) ||
      [m.entityId, ...m.otherEntityIds].some((id) => !lk.entity(id)),
  ).length;
  const win = lk.window(slate.windowId);
  const counts = { approved: 0, rejected: 0, pending: 0 };
  for (const m of onSlate) counts[m.status]++;

  const update = (fn: (m: SlateMarket) => SlateMarket, ids: Set<string>) =>
    props.onChange({ ...slate, markets: markets.map((m) => (ids.has(m.id) ? fn(m) : m)) });

  const setMsgs = (patch: Record<string, string | null>) =>
    setMessages((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        if (v) next[k] = v;
        else delete next[k];
      }
      return next;
    });

  const patchOne = (id: string, p: Partial<SlateMarket>) => {
    update((m) => ({ ...m, ...p }), new Set([id]));
    if (messages[id]) setMsgs({ [id]: null });
  };

  const approve = (ids: string[]) => {
    const now = new Date().toISOString();
    const ok = new Set<string>();
    const msgPatch: Record<string, string | null> = {};
    for (const m of onSlate.filter((x) => ids.includes(x.id) && x.status !== "approved")) {
      const problem = approvalProblem(m);
      msgPatch[m.id] = problem;
      if (!problem) ok.add(m.id);
    }
    update((m) => ({ ...m, status: "approved", decidedAt: now }), ok);
    setMsgs(msgPatch);
    const blocked = Object.values(msgPatch).filter(Boolean).length;
    return { approved: ok.size, blocked };
  };

  const reject = (ids: string[]) => {
    const now = new Date().toISOString();
    const set = new Set(onSlate.filter((m) => ids.includes(m.id) && m.status !== "rejected").map((m) => m.id));
    update((m) => ({ ...m, status: "rejected", decidedAt: now }), set);
    setMsgs(Object.fromEntries([...set].map((id) => [id, null])));
    return set.size;
  };

  const resetToPending = (ids: string[]) =>
    update((m) => ({ ...m, status: "pending", decidedAt: null }), new Set(ids));

  /** The reserve takes the slate market's place; the slate market goes back to reserves as pending. */
  const swap = (slateId: string, reserveId: string) => {
    const i = markets.findIndex((m) => m.id === slateId);
    const j = markets.findIndex((m) => m.id === reserveId);
    const next = [...markets];
    next[i] = { ...markets[j], onSlate: true };
    next[j] = { ...markets[i], onSlate: false, status: "pending", decidedAt: null };
    props.onChange({ ...slate, markets: next });
    setMsgs({ [slateId]: null });
    setSelected((prev) => {
      const s = new Set(prev);
      s.delete(slateId);
      return s;
    });
  };

  const addToSlate = (id: string) => update((m) => ({ ...m, onSlate: true }), new Set([id]));

  const selectedIds = [...selected].filter((id) => onSlate.some((m) => m.id === id));
  const allVisibleSelected = visible.length > 0 && visible.every((m) => selected.has(m.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section>
      <div className="review-head">
        <div>
          <h2>
            Review: {win?.label ?? missing(slate.windowId)}
            {slate.publishedAt && <span className="badge published">published {fmtDateTime(slate.publishedAt)}</span>}
            {readOnly && !slate.publishedAt && <span className="badge">read only</span>}
            {!readOnly && draft.dirty && <span className="badge warn-badge">unsaved</span>}
          </h2>
          <div className="muted">
            {slate.id}, created {fmtDateTime(slate.createdAt)}
          </div>
        </div>
        <div className="head-actions">
          {readOnly ? (
            <button className="primary" onClick={props.onReopen}>Reopen for editing</button>
          ) : (
            <button className="primary" onClick={props.onSave} disabled={!draft.dirty}>
              {draft.dirty ? "Save slate" : "Saved"}
            </button>
          )}
        </div>
      </div>

      {stale > 0 && (
        <div className="stale-banner">
          <strong>
            {stale} of {markets.length} markets refer to players, mechanics or a window no longer in config.
          </strong>{" "}
          This slate was generated from an older config. Slates are never regenerated automatically.
          <button className="primary" onClick={props.onRegenerate}>
            {lk.window(slate.windowId) ? "Generate a new slate from current config" : "Go to Set up"}
          </button>
        </div>
      )}

      <label className="hook">
        Hook
        <input
          value={slate.hook}
          disabled={readOnly}
          onChange={(e) => props.onChange({ ...slate, hook: e.target.value })}
          placeholder="No hook"
        />
      </label>

      <div className="counts">
        <span className="count approved">Approved {counts.approved}</span>
        <span className="count rejected">Rejected {counts.rejected}</span>
        <span className="count pending">Pending {counts.pending}</span>
        <span className="muted">
          {onSlate.length} markets on the slate, {reserves.length} reserves.
        </span>
      </div>

      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={mechFilter} onChange={(e) => setMechFilter(e.target.value)}>
          <option value="">All mechanics</option>
          {[...new Set(onSlate.map((m) => m.mechanicId))].map((id) => (
            <option key={id} value={id}>{lk.mechanic(id)?.name ?? missing(id)}</option>
          ))}
        </select>
        <input placeholder="Search entity or mechanic" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="muted">Showing {visible.length}</span>
      </div>

      {!readOnly && (
        <div className="toolbar bulk">
          <strong>{selectedIds.length} selected</strong>
          <button
            disabled={!selectedIds.length}
            onClick={() => {
              const r = approve(selectedIds);
              setBulkNote(`Approved ${r.approved}${r.blocked ? `, ${r.blocked} blocked (see row messages)` : ""}.`);
            }}
          >
            Approve selected
          </button>
          <button
            disabled={!selectedIds.length}
            onClick={() => setBulkNote(`Rejected ${reject(selectedIds)}.`)}
          >
            Reject selected
          </button>
          <button disabled={!selectedIds.length} onClick={() => resetToPending(selectedIds)}>
            Reset to pending
          </button>
          <span className="sep" />
          <input
            placeholder="Approver name"
            value={bulkApprover}
            onChange={(e) => setBulkApprover(e.target.value)}
          />
          <button
            disabled={!selectedIds.length || !bulkApprover.trim()}
            title="Fills the approver on selected pending rows"
            onClick={() => {
              const pending = new Set(
                onSlate.filter((m) => selected.has(m.id) && m.status === "pending").map((m) => m.id),
              );
              update((m) => ({ ...m, approver: bulkApprover.trim() }), pending);
              setBulkNote(`Approver set on ${pending.size} pending rows.`);
            }}
          >
            Set approver on selected
          </button>
          {bulkNote && <span className="muted">{bulkNote}</span>}
        </div>
      )}

      <div className="table-wrap">
        <table className="grid review">
          <thead>
            <tr>
              {!readOnly && (
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all visible"
                    checked={allVisibleSelected}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const m of visible) {
                          if (allVisibleSelected) next.delete(m.id);
                          else next.add(m.id);
                        }
                        return next;
                      })
                    }
                  />
                </th>
              )}
              <th className="num">#</th>
              <th>Mechanic</th>
              <th>Entity / entities</th>
              {!readOnly && <th title="Replace this market with a reserve">Swap</th>}
              <th>Metric</th>
              <th>Operator</th>
              <th className="num">Line</th>
              <th>Window</th>
              <th>Source market</th>
              <th>Tie rule</th>
              <th>Yes</th>
              <th>No</th>
              <th>Approver</th>
              <th>Status</th>
              {!readOnly && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => {
              const mech = lk.mechanic(m.mechanicId);
              const locked = readOnly || m.status !== "pending";
              const idx = onSlate.indexOf(m) + 1;
              const msg = messages[m.id];
              const cols = readOnly ? 13 : 16;
              return [
                <tr key={m.id} className={`status-${m.status}${selected.has(m.id) ? " selected" : ""}`}>
                  {!readOnly && (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select row ${idx}`}
                        checked={selected.has(m.id)}
                        onChange={() => toggle(m.id)}
                      />
                    </td>
                  )}
                  <td className="num muted">{idx}</td>
                  <td title={question(lk, m)}>{mech?.name ?? missing(m.mechanicId)}</td>
                  <td title={question(lk, m)}>{entitiesLabel(lk, m)}</td>
                  {!readOnly && (
                    <td>
                      {m.status === "approved" ? (
                        <span className="muted tiny">undo to swap</span>
                      ) : (
                        <SwapSelect market={m} reserves={reserves} lk={lk} onSwap={(rid) => swap(m.id, rid)} />
                      )}
                    </td>
                  )}
                  <td>{mech?.metric}</td>
                  <td>{mech?.operator}</td>
                  <td className="num">{m.line ?? ""}</td>
                  <td>{lk.window(m.windowId)?.label ?? missing(m.windowId)}</td>
                  <td>{mech?.sourceMarket}</td>
                  <td className="tie">{mech?.tieRule}</td>
                  <td>
                    <PriceInput label="Yes price" value={m.yesPrice} disabled={locked}
                      onChange={(v) => patchOne(m.id, { yesPrice: v })} />
                  </td>
                  <td>
                    <PriceInput label="No price" value={m.noPrice} disabled={locked}
                      onChange={(v) => patchOne(m.id, { noPrice: v })} />
                  </td>
                  <td>
                    <input
                      className="approver"
                      aria-label="Approver"
                      value={m.approver ?? ""}
                      disabled={locked}
                      onChange={(e) => patchOne(m.id, { approver: e.target.value || null })}
                    />
                  </td>
                  <td>
                    <span className={`pill ${m.status}`}>{m.status}</span>
                    {m.decidedAt && <div className="tiny muted">{fmtDateTime(m.decidedAt)}</div>}
                  </td>
                  {!readOnly && (
                    <td className="actions">
                      {m.status === "pending" ? (
                        <>
                          <button className="ok" onClick={() => approve([m.id])}>Approve</button>
                          <button className="no" onClick={() => reject([m.id])}>Reject</button>
                        </>
                      ) : (
                        <button onClick={() => resetToPending([m.id])}>Undo</button>
                      )}
                    </td>
                  )}
                </tr>,
                msg && (
                  <tr key={`${m.id}-msg`} className="msg-row">
                    <td colSpan={cols}><span className="msg">Row {idx}: {msg}</span></td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="empty">No rows match the filters.</p>}
      </div>

      <h3>
        Reserves ({reserves.length}){" "}
        <button className="link" onClick={() => setShowReserves((v) => !v)}>{showReserves ? "hide" : "show"}</button>
      </h3>
      {showReserves && (
        reserves.length === 0 ? (
          <p className="muted">No reserves. Raise a mechanic's possible markets or lower its count under Set up.</p>
        ) : (
          <div className="table-wrap">
            <table className="grid review">
              <thead>
                <tr>
                  <th>Mechanic</th><th>Entity / entities</th><th>Question</th>{!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {reserves.map((r) => (
                  <tr key={r.id} className="reserve">
                    <td>{lk.mechanic(r.mechanicId)?.name ?? missing(r.mechanicId)}</td>
                    <td>{entitiesLabel(lk, r)}</td>
                    <td>{question(lk, r)}</td>
                    {!readOnly && (
                      <td>
                        <button onClick={() => addToSlate(r.id)} title="Adds it to the slate without removing anything">
                          Add to slate
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
