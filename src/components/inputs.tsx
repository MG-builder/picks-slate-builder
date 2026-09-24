import { useEffect, useState } from "react";
import { parsePrice } from "../lib/format";

/**
 * Text input that keeps its own text while typing and commits on blur or Enter.
 * Used for numbers and comma lists, where committing every keystroke would mangle input.
 */
export function CommitInput(props: {
  value: string;
  onCommit: (text: string) => void;
  className?: string;
  placeholder?: string;
  title?: string;
}) {
  const [text, setText] = useState(props.value);
  useEffect(() => setText(props.value), [props.value]);
  const commit = () => {
    if (text !== props.value) props.onCommit(text);
  };
  return (
    <input
      className={props.className}
      value={text}
      placeholder={props.placeholder}
      title={props.title}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setText(props.value);
      }}
    />
  );
}

export const joinList = (xs: (string | number)[]) => xs.join(", ");
export const splitList = (t: string) =>
  t.split(",").map((s) => s.trim()).filter(Boolean);
export const splitNumbers = (t: string) =>
  splitList(t).map(Number).filter((n) => Number.isFinite(n));

/** Price entry. Records what the trader types; the only check is "positive number". */
export function PriceInput(props: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  label: string;
}) {
  const [text, setText] = useState(props.value == null ? "" : String(props.value));
  useEffect(() => {
    if (parsePrice(text) !== props.value) setText(props.value == null ? "" : String(props.value));
    // Only resync when the stored value changes from outside this input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  const invalid = text.trim() !== "" && parsePrice(text) == null;
  return (
    <input
      className={`price${invalid ? " invalid" : ""}`}
      inputMode="decimal"
      aria-label={props.label}
      title={invalid ? "Must be a positive number" : props.label}
      value={text}
      disabled={props.disabled}
      onChange={(e) => {
        setText(e.target.value);
        props.onChange(parsePrice(e.target.value));
      }}
    />
  );
}
