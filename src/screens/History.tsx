import type { Config, Slate } from "../types";
import { fmtDateTime, makeLookup, missing } from "../lib/format";

export default function HistoryScreen(props: {
  config: Config;
  slates: Slate[];
  currentId: string | null;
  onOpen: (s: Slate) => void;
}) {
  const lk = makeLookup(props.config);
  const rows = [...props.slates].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!rows.length) return <p className="empty">No saved slates yet. Save a slate from Review to see it here.</p>;

  return (
    <section>
      <h2>History</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>Created</th><th>Window</th><th>Hook</th><th>Status</th><th className="num">On slate</th>
            <th className="num">Approved</th><th className="num">Rejected</th><th className="num">Pending</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const slate = s.markets.filter((m) => m.onSlate);
            const count = (st: string) => slate.filter((m) => m.status === st).length;
            return (
              <tr key={s.id} className={s.id === props.currentId ? "selected" : ""}>
                <td>{fmtDateTime(s.createdAt)}</td>
                <td>{lk.window(s.windowId)?.label ?? missing(s.windowId)}</td>
                <td>{s.hook || <span className="muted">none</span>}</td>
                <td>
                  {s.publishedAt ? (
                    <span className="badge published">published {fmtDateTime(s.publishedAt)}</span>
                  ) : (
                    <span className="muted">draft</span>
                  )}
                </td>
                <td className="num">{slate.length}</td>
                <td className="num">{count("approved")}</td>
                <td className="num">{count("rejected")}</td>
                <td className="num">{count("pending")}</td>
                <td>
                  <button onClick={() => props.onOpen(s)}>Open</button>
                  {s.id === props.currentId && <span className="muted"> open in Review</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
