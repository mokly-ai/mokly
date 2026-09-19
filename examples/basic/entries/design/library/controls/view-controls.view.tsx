import { useId } from "react";

import { ViewIcon } from "../../components/parts/view_icons.js";
import { DesignLink } from "../../parts/design_navigation.js";
import { useDesignStyle } from "../style_context.js";

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
export function ViewControlsView({
  selection,
  scheme,
  highlight,
  unavailable,
  schemeDisabled,
  schemeControl,
  destinations,
}: ViewControlsProps) {
  useDesignStyle("view-controls");
  const reasonId = useId();
  const nextScheme = scheme === "light" ? "dark" : "light";
  const schemeDestination = schemeDisabled
    ? undefined
    : destinations[nextScheme];
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
      </label>
      {schemeControl === false ? null : schemeDestination ? (
        <DesignLink to={schemeDestination}>
          <span
            className="ce-icon-control ce-theme-control"
            data-scheme={scheme}
            aria-label={`Switch to ${nextScheme} mode`}
            title={`Switch to ${nextScheme} mode`}
          >
            <ViewIcon kind="light" />
            <ViewIcon kind="dark" />
          </span>
        </DesignLink>
      ) : (
        <label
          className="ce-icon-control ce-theme-control"
          title={
            schemeDisabled
              ? "No alternate theme for this view"
              : "Toggle light/dark mode"
          }
        >
          <input
            type="checkbox"
            role="switch"
            className="ce-theme-toggle"
            aria-label="Dark mode"
            defaultChecked={scheme === "dark"}
            disabled={schemeDisabled}
          />
          <ViewIcon kind="light" />
          <ViewIcon kind="dark" />
        </label>
      )}
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
