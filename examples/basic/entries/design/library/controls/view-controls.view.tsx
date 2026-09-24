import { useId } from "react";

import { ViewIcon } from "../../components/parts/view_icons.js";

import type { ViewControlsProps } from "./view-controls.js";

const reasons = {
  empty: "No registered components in this view",
  unavailable: "Component inspection is unavailable",
  comparison: "Highlighting is unavailable in comparisons",
  removed: "Highlighting is unavailable for removed screens",
} as const;
const viewportOptions = [
  ["mobile", "Mobile"],
  ["desktop", "Desktop"],
  ["both", "Both"],
] as const;

/** Per-view change evidence: a mark points at views other than this one. */
function ChangedMark() {
  return <span className="ce-view-changed" aria-hidden="true" />;
}

export function ViewControlsView({
  selection,
  highlight,
  unavailable,
  changedViews,
}: ViewControlsProps) {
  const reasonId = useId();
  const changed = changedViews ?? [];
  const viewportChanged =
    selection !== "both" && changed.some((view) => view.viewport !== selection);
  const reason = unavailable ? reasons[unavailable] : undefined;
  return (
    <div
      className="ce-view-controls"
      role="toolbar"
      aria-label="Preview options"
    >
      <label
        className="ce-icon-control ce-viewport-control"
        title="Preview viewport"
      >
        <ViewIcon kind="mobile" />
        <ViewIcon kind="desktop" />
        <ViewIcon kind="both" />
        <ViewIcon kind="chevron" size={12} />
        <select
          className="ce-viewport-select"
          aria-label="Preview viewport"
          defaultValue={selection}
        >
          {viewportOptions.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {viewportChanged ? <ChangedMark /> : null}
      </label>
      {highlight === undefined ? null : (
        <label
          className="ce-icon-control ce-highlight-control"
          title={reason ?? "Highlight components"}
        >
          <input
            type="checkbox"
            role="switch"
            className="ce-highlight-toggle"
            aria-label="Highlight components"
            aria-describedby={reason ? reasonId : undefined}
            defaultChecked={highlight}
            disabled={reason !== undefined}
          />
          <ViewIcon kind="highlight" />
          {reason ? (
            <span id={reasonId} className="ce-control-description">
              {reason}
            </span>
          ) : null}
        </label>
      )}
    </div>
  );
}
