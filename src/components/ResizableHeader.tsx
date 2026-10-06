import { useEffect, useRef, useState } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  /** Default width in pixels. */
  width: number;
  title?: string;
}

const MIN_WIDTH = 36;
const storageKey = (tableId: string) => `psb.v1.colwidths.${tableId}`;

function loadWidths(tableId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(tableId));
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveWidths(tableId: string, widths: Record<string, number>) {
  try {
    localStorage.setItem(storageKey(tableId), JSON.stringify(widths));
  } catch {
    // Widths are a convenience; losing them is fine.
  }
}

/**
 * Column widths for a table, remembered per browser. Returns the width for each column and
 * the total, so the table can use a fixed layout at exactly that width.
 */
export function useColumnWidths(tableId: string, columns: ColumnDef[]) {
  const [custom, setCustom] = useState<Record<string, number>>(() => loadWidths(tableId));
  const widthOf = (c: ColumnDef) => custom[c.key] ?? c.width;
  const setWidth = (key: string, width: number | null) =>
    setCustom((prev) => {
      const next = { ...prev };
      if (width == null) delete next[key];
      else next[key] = Math.max(MIN_WIDTH, Math.round(width));
      saveWidths(tableId, next);
      return next;
    });
  const total = columns.reduce((n, c) => n + widthOf(c), 0);
  const reset = () => {
    setCustom({});
    saveWidths(tableId, {});
  };
  return { widthOf, setWidth, total, reset, customised: Object.keys(custom).length > 0 };
}

/** Drag the right edge of a header to resize its column; double-click to reset it. */
function Resizer(props: { width: number; onResize: (w: number | null) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      if (start.current) props.onResize(start.current.w + e.clientX - start.current.x);
    };
    const up = () => {
      start.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, props]);

  return (
    <span
      className={`col-resizer${dragging ? " dragging" : ""}`}
      title="Drag to resize. Double-click to reset."
      onPointerDown={(e) => {
        e.preventDefault();
        start.current = { x: e.clientX, w: props.width };
        setDragging(true);
      }}
      onDoubleClick={() => props.onResize(null)}
    />
  );
}

/** <colgroup> and <thead> for a table whose columns can be resized. */
export function ResizableHeader(props: {
  columns: ColumnDef[];
  widthOf: (c: ColumnDef) => number;
  setWidth: (key: string, width: number | null) => void;
}) {
  return (
    <>
      <colgroup>
        {props.columns.map((c) => <col key={c.key} style={{ width: props.widthOf(c) }} />)}
      </colgroup>
      <thead>
        <tr>
          {props.columns.map((c) => (
            <th key={c.key} title={c.title} className="resizable-th">
              <span className="th-label">{c.label}</span>
              <Resizer width={props.widthOf(c)} onResize={(w) => props.setWidth(c.key, w)} />
            </th>
          ))}
        </tr>
      </thead>
    </>
  );
}
