import { useMemo, useState } from "react";
import type { Config, Slate } from "../types";
import { createSlate, droppedSummary, runPipeline } from "../lib/generate";
import { fmtDateTime, makeLookup } from "../lib/format";

export default function GenerateScreen(props: { config: Config; onGenerate: (s: Slate) => void }) {
  const { config } = props;
  const [windowId, setWindowId] = useState(config.windows[0]?.id ?? "");
  const [hook, setHook] = useState("");
  const lk = makeLookup(config);
  const win = lk.window(windowId) ?? config.windows[0];

  const result = useMemo(() => (win ? runPipeline(config, win) : null), [config, win]);

  if (!win || !result) {
    return <p className="empty">No windows configured. Add one under Config.</p>;
  }

  const eligible = result.eligible.length;
  const over = eligible - config.rules.slateSize;

  return (
    <section>
      <h2>Generate</h2>
      <div className="form-row">
        <label>
          Window
          <select value={win.id} onChange={(e) => setWindowId(e.target.value)}>
            {config.windows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label} ({w.kind})
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          Weekly hook (optional)
          <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="e.g. Derby weekend" />
        </label>
        <button
          className="primary"
          disabled={eligible === 0}
          onClick={() => props.onGenerate(createSlate(win, hook, result.eligible))}
        >
          Generate
        </button>
      </div>
      <p className="muted">
        {win.kind}, {win.roundIds.length} rounds ({win.roundIds.slice(0, 4).join(", ")}
        {win.roundIds.length > 4 ? ", ..." : ""}), opens {fmtDateTime(win.opensAt, true)}, closes{" "}
        {fmtDateTime(win.closesAt, true)}
      </p>

      <table className="stats">
        <tbody>
          <tr><th>Candidates (before filter)</th><td>{result.candidates.length}</td></tr>
          <tr><th>After eligibility filter</th><td>{eligible}</td></tr>
          <tr>
            <th>Slate size (hint)</th>
            <td>
              {config.rules.slateSize}
              {over > 0 ? (
                <span className="warn"> : {over} candidates over slate size, all will be shown in Review</span>
              ) : (
                <span className="muted"> : within slate size</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="drop-line">{droppedSummary(result, win)}</p>
      {result.pairCaps.map((p) => (
        <p key={p.mechanicId} className="warn">
          Pair cap: {lk.mechanic(p.mechanicId)?.name} generated {p.generated} of {p.available} possible pairs
          (cap {config.rules.pairCap}, set under Config, Rules).
        </p>
      ))}
      {eligible === 0 && <p className="error">No candidates survive the filter for this window.</p>}

      <h3>By mechanic</h3>
      <table className="grid">
        <thead>
          <tr>
            <th>Mechanic</th><th>Phase</th><th>Ceiling</th><th className="num">Candidates</th>
            <th className="num">Kept</th><th>Reason dropped</th>
          </tr>
        </thead>
        <tbody>
          {result.breakdown.map((b) => {
            const m = lk.mechanic(b.mechanicId)!;
            const reasons = [
              !b.ceilingOk && `window ceiling ${m.windowCeiling} cannot cover ${win.kind}`,
              !b.phaseLive && `phase ${m.phase} not live`,
            ].filter(Boolean);
            return (
              <tr key={b.mechanicId} className={reasons.length ? "dim" : ""}>
                <td>{m.name}</td>
                <td>{m.phase}</td>
                <td>{m.windowCeiling}</td>
                <td className="num">{b.candidates}</td>
                <td className="num">{reasons.length ? 0 : b.candidates}</td>
                <td>{reasons.join("; ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
