import type { Config, MarketWindow } from "../types";
import { type PipelineResult, slateSize } from "../lib/generate";
import { makeLookup } from "../lib/format";

/** Why a mechanic produces nothing for this window, or null if it produces markets. */
export function notGeneratedReason(
  config: Config,
  window: MarketWindow,
  b: PipelineResult["breakdown"][number],
): string | null {
  const m = config.mechanics.find((x) => x.id === b.mechanicId)!;
  if (!b.enabled) return "unticked";
  if (!b.windowOk) {
    const range = m.windowFloor === m.windowCeiling ? `${m.windowFloor} windows only` : `${m.windowFloor} to ${m.windowCeiling} windows`;
    return `fills ${range}, not ${window.kind}`;
  }
  if (b.candidates === 0) return "no players fit its slots and group rule";
  return null;
}

/** Live count of what Generate would produce for a window with the current config. */
export default function SlatePreview(props: { config: Config; window: MarketWindow; result: PipelineResult }) {
  const { config, window, result } = props;
  const lk = makeLookup(config);
  const target = config.rules.slateSize;
  const onSlate = slateSize(result);
  const reserves = result.selected.length - onSlate;
  const clashes = new Map(result.fixtureClashes.map((f) => [f.mechanicId, f.dropped]));
  const rows = result.breakdown.filter((b) => b.enabled);
  const usable = rows.filter((b) => !notGeneratedReason(config, window, b));
  const countTotal = usable.reduce((n, b) => n + Math.max(0, lk.mechanic(b.mechanicId)!.count), 0);

  const notes: string[] = [];
  if (onSlate < target) {
    notes.push(`Only ${onSlate} markets are possible from the ticked mechanics, so the slate is short of ${target}.`);
  } else if (countTotal > target) {
    notes.push(
      `The counts add up to ${countTotal}, more than the slate size of ${target}, so mechanics lower in the list get fewer.`,
    );
  } else if (countTotal < target) {
    notes.push(
      `The counts add up to ${countTotal}, so ${target - countTotal} more are added, one at a time from each ticked mechanic in turn.`,
    );
  }

  return (
    <div className="preview">
      <p className="preview-total">
        <strong>{onSlate} markets on the slate</strong>
        <span className="muted"> + {reserves} reserves for {window.label}</span>
      </p>
      {notes.map((n) => <p key={n} className="warn">{n}</p>)}
      <table className="grid">
        <thead>
          <tr>
            <th>Mechanic</th>
            <th className="num" title="Markets possible from the players, slots, group rule and fixtures">Possible</th>
            <th className="num">Count</th>
            <th className="num">On slate</th>
            <th className="num" title="Possible markets not on the slate, swappable in Review">Reserves</th>
            <th className="num" title="Groups left out because their teams play each other in this window">
              Removed: teams play each other
            </th>
            <th>Not generated because</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const m = lk.mechanic(b.mechanicId)!;
            const reason = notGeneratedReason(config, window, b);
            return (
              <tr key={b.mechanicId} className={reason ? "dim" : ""}>
                <td>{m.name}</td>
                <td className="num">{b.candidates}</td>
                <td className="num">{m.count}</td>
                <td className={`num${b.onSlate !== m.count && !reason ? " warn" : ""}`}>{b.onSlate}</td>
                <td className="num">{b.reserves}</td>
                <td className="num">{clashes.get(b.mechanicId) ?? ""}</td>
                <td>{reason ?? ""}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">No mechanics ticked. Tick some in the Mechanics table below.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="muted tiny">
        Multi-player markets need players from different matches. "Removed: teams play each other" counts the groups
        left out because their clubs meet in this window, e.g. Haaland with Isak when Liverpool play Man City.
      </p>
      {result.groupCaps.map((p) => (
        <p key={p.mechanicId} className="warn">
          {lk.mechanic(p.mechanicId)?.name}: only the first {p.generated} of {p.available} possible groups are kept
          (max candidates per mechanic is {config.rules.groupCap}, under Rules).
        </p>
      ))}
    </div>
  );
}
