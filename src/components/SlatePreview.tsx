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
  if (!b.ceilingOk) return `${m.windowCeiling} mechanic cannot fill a ${window.kind} window`;
  if (b.candidates === 0) return "no players fit its slots and group rule";
  if (m.count <= 0) return "count is 0";
  return null;
}

/** Live count of what Generate would produce for a window with the current config. */
export default function SlatePreview(props: {
  config: Config;
  window: MarketWindow;
  result: PipelineResult;
  compact?: boolean;
}) {
  const { config, window, result } = props;
  const lk = makeLookup(config);
  const onSlate = slateSize(result);
  const reserves = result.selected.length - onSlate;
  const clashes = new Map(result.fixtureClashes.map((f) => [f.mechanicId, f.dropped]));
  const rows = props.compact ? result.breakdown.filter((b) => b.enabled) : result.breakdown;

  return (
    <div className={props.compact ? "preview compact" : "preview"}>
      <p className="preview-total">
        <strong>{onSlate} markets on the slate</strong>
        <span className="muted">
          {" "}+ {reserves} reserves for {window.label}
        </span>
      </p>
      <table className="grid">
        <thead>
          <tr>
            <th>Mechanic</th>
            {!props.compact && <th>Ticked</th>}
            <th className="num" title="Markets possible from the players, slots, group rule and fixtures">Possible</th>
            <th className="num" title="Set by the mechanic's count">On slate</th>
            <th className="num" title="Possible markets beyond the count, swappable in Review">Reserves</th>
            <th className="num" title="Groups never generated because their teams play each other in this window">
              Fixture clashes
            </th>
            <th>Not generated because</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const m = lk.mechanic(b.mechanicId)!;
            const reason = notGeneratedReason(config, window, b);
            const short = b.enabled && !reason && b.onSlate < m.count;
            return (
              <tr key={b.mechanicId} className={reason ? "dim" : ""}>
                <td>{m.name}</td>
                {!props.compact && <td>{m.enabled ? "Yes" : "No"}</td>}
                <td className="num">{b.candidates}</td>
                <td className="num">
                  {b.onSlate}
                  {short && <span className="warn" title={`Count is ${m.count}, only ${b.onSlate} possible`}> of {m.count}</span>}
                </td>
                <td className="num">{b.reserves}</td>
                <td className="num">{clashes.get(b.mechanicId) ?? ""}</td>
                <td>{reason ?? ""}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">No mechanics ticked. Tick some under Config, Mechanics.</td>
            </tr>
          )}
        </tbody>
      </table>
      {result.groupCaps.map((p) => (
        <p key={p.mechanicId} className="warn">
          {lk.mechanic(p.mechanicId)?.name}: only the first {p.generated} of {p.available} possible groups are kept
          (max candidates per mechanic is {config.rules.groupCap}, under Config, Rules).
        </p>
      ))}
    </div>
  );
}
