import { useMemo, useState } from "react";
import type { Config, Slate } from "../types";
import { createSlate, runPipeline, slateSize } from "../lib/generate";
import { fmtDateTime, makeLookup } from "../lib/format";
import SlatePreview from "../components/SlatePreview";

export default function GenerateScreen(props: {
  config: Config;
  windowId: string;
  onWindowChange: (id: string) => void;
  onGenerate: (s: Slate) => void;
}) {
  const { config } = props;
  const [hook, setHook] = useState("");
  const lk = makeLookup(config);
  const win = lk.window(props.windowId) ?? config.windows[0];

  const result = useMemo(() => (win ? runPipeline(config, win) : null), [config, win]);

  if (!win || !result) {
    return <p className="empty">No windows configured. Add one under Config, Windows.</p>;
  }

  const onSlate = slateSize(result);

  return (
    <section>
      <h2>Generate</h2>
      <p className="muted">
        Generates from what is set up under Config: ticked mechanics, their counts, eligible players and the window's
        fixtures.
      </p>
      <div className="form-row">
        <label>
          Window
          <select value={win.id} onChange={(e) => props.onWindowChange(e.target.value)}>
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
          disabled={onSlate === 0}
          onClick={() => props.onGenerate(createSlate(win, hook, result.selected))}
        >
          Generate {onSlate} markets
        </button>
      </div>
      <p className="muted">
        {win.kind}, {win.fixtures.length} fixtures, opens {fmtDateTime(win.opensAt, true)}, closes{" "}
        {fmtDateTime(win.closesAt, true)}
      </p>
      <SlatePreview config={config} window={win} result={result} />
      {onSlate === 0 && <p className="error">Nothing to generate for this window. Tick a mechanic or set a count.</p>}
    </section>
  );
}
