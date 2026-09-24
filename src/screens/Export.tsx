import { useState } from "react";
import type { Config } from "../types";
import type { Draft } from "../lib/storage";
import { approvedCsv, downloadText, slackSummary } from "../lib/export";
import { entitiesLabel, makeLookup, missing, question } from "../lib/format";

export default function ExportScreen(props: { config: Config; draft: Draft | null }) {
  const [copied, setCopied] = useState("");
  const { draft } = props;
  if (!draft) return <p className="empty">No slate open. Generate one or open one from History.</p>;

  const lk = makeLookup(props.config);
  const { slate } = draft;
  const approved = slate.markets.filter((m) => m.status === "approved");
  const summary = slackSummary(slate, lk);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied("Copied.");
    } catch {
      setCopied("Copy failed: select the text and copy it manually.");
    }
  };

  return (
    <section>
      <h2>Export: {lk.window(slate.windowId)?.label ?? missing(slate.windowId)}</h2>
      <p className="muted">
        {slate.id}. {approved.length} approved of {slate.markets.length}.
        {draft.dirty && <span className="warn"> The slate has unsaved changes; export reflects the working copy.</span>}
      </p>

      <h3>CSV</h3>
      <button
        className="primary"
        disabled={!approved.length}
        onClick={() => downloadText(`${slate.id}-approved.csv`, approvedCsv(slate, lk))}
      >
        Download approved markets CSV
      </button>
      {!approved.length && <span className="muted"> Nothing approved yet.</span>}

      <h3>Slack summary</h3>
      <textarea className="summary" readOnly value={summary} rows={Math.min(24, approved.length + 5)} />
      <div>
        <button onClick={copy}>Copy to clipboard</button> <span className="muted">{copied}</span>
      </div>

      {approved.length > 0 && (
        <>
          <h3>Approved markets</h3>
          <table className="grid">
            <thead>
              <tr><th>Question</th><th>Entities</th><th className="num">Line</th><th className="num">Yes</th><th className="num">No</th><th>Approver</th></tr>
            </thead>
            <tbody>
              {approved.map((m) => (
                <tr key={m.id}>
                  <td>{question(lk, m)}</td>
                  <td>{entitiesLabel(lk, m)}</td>
                  <td className="num">{m.line ?? ""}</td>
                  <td className="num">{m.yesPrice}</td>
                  <td className="num">{m.noPrice}</td>
                  <td>{m.approver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
