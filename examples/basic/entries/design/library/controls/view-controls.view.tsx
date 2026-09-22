import { useId } from "react";

import { ViewIcon } from "../../components/parts/view_icons.js";
import { DesignLink } from "../../parts/design_navigation.js";
import { SelectionControl } from "../../parts/selection_control.js";
import { useDesignStyle } from "../style_context.js";

import type { ViewControlsProps } from "./view-controls.js";

const reasons = {
  empty: "No registered components in this view",
  unavailable: "Component inspection is unavailable",
  comparison: "Highlighting is unavailable in comparisons",
  removed: "Highlighting is unavailable for removed screens",
  live: "Highlighting works in Static.",
} as const;
const LIVE_UNAVAILABLE = "Live preview is unavailable for this view.";
const viewportOptions = [
  ["mobile", "Mobile"],
  ["desktop", "Desktop"],
  ["both", "Both"],
] as const;

/** Per-view change evidence: a mark points at views other than this one. */
function ChangedMark() {
  return <span className="ce-view-changed" aria-hidden="true" />;
}

/**
 * Static and Live for one view. The segment stays a depiction when the
 * catalogue has no artboard for the other mode, and Live becomes a described
 * non-control when the view cannot offer it.
 */
function PreviewModeControl({
  mode,
  disabled,
  destinations,
}: {
  mode: NonNullable<ViewControlsProps["previewMode"]>;
  disabled: boolean;
  destinations: NonNullable<ViewControlsProps["previewModeDestinations"]>;
}) {
  const reasonId = useId();
  return (
    <span
      className="mbk-seg ce-preview-mode"
      role="group"
      aria-label="Preview mode"
    >
      <SelectionControl
        active={mode === "static"}
        label="Static"
        to={mode === "static" ? undefined : destinations.static}
      />
      {disabled ? (
        <span
          className="ce-preview-mode-off"
          aria-disabled="true"
          aria-describedby={reasonId}
          title={LIVE_UNAVAILABLE}
        >
          Live
          <span id={reasonId} className="ce-control-description">
            {LIVE_UNAVAILABLE}
          </span>
        </span>
      ) : (
        <SelectionControl
          active={mode === "live"}
          label="Live"
          to={mode === "live" ? undefined : destinations.live}
        />
      )}
    </span>
  );
}

export function ViewControlsView({
  selection,
  scheme,
  highlight,
  unavailable,
  schemeDisabled,
  previewMode,
  previewModeDisabled,
  previewModeDestinations,
  changedViews,
  destinations,
}: ViewControlsProps) {
  useDesignStyle("view-controls");
  const reasonId = useId();
  const changed = changedViews ?? [];
  const schemeChanged = changed.some((view) => view.scheme !== scheme);
  const viewportChanged =
    selection !== "both" && changed.some((view) => view.viewport !== selection);
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
        {viewportChanged ? <ChangedMark /> : null}
      </label>
      {schemeDestination ? (
        <DesignLink to={schemeDestination}>
          <span
            className="ce-icon-control ce-theme-control"
            data-scheme={scheme}
            aria-label={`Switch to ${nextScheme} mode`}
            title={`Switch to ${nextScheme} mode`}
          >
            <ViewIcon kind="light" />
            <ViewIcon kind="dark" />
            {schemeChanged ? <ChangedMark /> : null}
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
          {schemeChanged ? <ChangedMark /> : null}
        </label>
      )}
      {previewMode === undefined ? null : (
        <PreviewModeControl
          mode={previewMode}
          disabled={previewModeDisabled ?? false}
          destinations={previewModeDestinations ?? {}}
        />
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
