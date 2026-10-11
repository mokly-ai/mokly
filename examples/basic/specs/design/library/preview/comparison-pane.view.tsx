import type { ComparisonPaneProps } from "./comparison-pane.js";

export function ComparisonPaneView({
  children,
  side,
  label,
  state,
  message,
}: ComparisonPaneProps) {
  return (
    <div className={`mbk-compare-side mbk-compare-side--${side}`}>
      <p className="mbk-compare-label">{label}</p>
      {state === "missing" ? (
        <div className="mbk-pane-missing">{message}</div>
      ) : (
        children
      )}
    </div>
  );
}
