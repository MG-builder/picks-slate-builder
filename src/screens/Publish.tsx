import { useState } from "react";
import type { Config } from "../types";
import type { Draft } from "../lib/storage";
import { approvedCsv, downloadText, slackSummary } from "../lib/export";
import { entitiesLabel, fmtDateTime, makeLookup, missing, question } from "../lib/format";

/** Problems that block publishing; empty when the slate can go out. */
export function publishProblems(draft: Draft): string[] {
  const onSlate = draft.slate.markets.filter((m) => m.onSlate);
  const pending = onSlate.filter((m) => m.status === "pending").length;
  const approved = onSlate.filter((m) => m.status === "approved").length;
  return [
    pending > 0 && `${pending} market${pending === 1 ? " is" : "s are"} still pending in Review. Approve, reject or swap ${pending === 1 ? "it" : "them"}.`,
    approved === 0 && "Nothing is approved.",
  ].filter((x): x is string => Boolean(x));
}

export default function PublishScreen(props: { config: Config; draft: Draft | null; onPublish: () => void }) {
  const [copied, setCopied] = useState("");
  const { draft } = props;
  if (!draft) return <p className="empty">No slate open. Generate one or open one from History.</p>;

  const lk = makeLookup(props.config);
  const { slate } = draft;
  const onSlate = slate.markets.filter((m) => m.onSlate);
  const approved = onSlate.filter((m) => m.status === "approved");
  const rejected = onSlate.filter((m) => m.status === "rejected").length;
  const problems = publishProblems(draft);
  const published = Boolean(slate.publishedAt);
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
      <h2>
        Publish: {lk.window(slate.windowId)?.label ?? missing(slate.windowId)}
        {published && <span className="badge published">published {fmtDateTime(slate.publishedAt)}</span>}
      </h2>
      <p className="muted">
        Publishing saves the slate to History, locks it, and gives you the CSV and Slack text. Only approved markets on
        the slate go out.
      </p>

      {!published && (
        <>
          <ul className="publish-checks">
            <li className="ok-text">{approved.length} approved, will be published</li>
            {rejected > 0 && (
              <li className="muted">{rejected} rejected, left out (swap in a reserve from Review to replace them)</li>
            )}
            {problems.map((p) => <li key={p} className="error">{p}</li>)}
          </ul>
          <button className="primary" disabled={problems.length > 0} onClick={props.onPublish}>
            Publish {approved.length} markets
          </button>
        </>
      )}

      <h3>CSV</h3>
      <button
        className={published ? "primary" : ""}
        disabled={!published}
        onClick={() => downloadText(`${slate.id}-published.csv`, approvedCsv(slate, lk))}
      >
        Download published markets CSV
      </button>
      {!published && <span className="muted"> Available once published.</span>}

      <h3>Slack summary{!published && " (preview)"}</h3>
      <textarea className="summary" readOnly value={summary} rows={Math.min(24, approved.length + 5)} />
      <div>
        <button onClick={copy} disabled={!published}>Copy to clipboard</button> <span className="muted">{copied}</span>
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
