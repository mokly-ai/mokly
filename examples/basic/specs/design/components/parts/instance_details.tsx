import { MockLink } from "@mokly/mokly";

import { MetaRow } from "../../parts/metadata_row.js";

import { footerLabelChange } from "./comparison_fixtures.js";
import { toolbarPrompt } from "./fixtures.js";
import { PropValues } from "./prop_values.js";
import type { ScreenPageState } from "./screen_preview.js";

/** Selected instance data follows the component reached from the usage link. */
export function InstanceDetails({ state }: { state: ScreenPageState }) {
  const toolbar = state === "toolbar-selection";
  const help = state === "help-selection";
  const nested = state === "nested";
  const consumer = state === "consumer";
  const title = toolbar ? "Toolbar" : help ? "Help hint" : "Action";
  const label = toolbar
    ? "Main"
    : help
      ? "Help"
      : nested
        ? "Toolbar action"
        : consumer
          ? "Continue"
          : "Footer action";
  return (
    <section className="ce-selected-instance" aria-label="Selected instance">
      <h3>
        {title} <span>{label}</span>
      </h3>
      {toolbar || help ? (
        <dl className="ce-props" aria-label="Supplied props">
          <MetaRow
            name="selected-prop"
            label={toolbar ? "prompt" : "visible"}
            presentation="props"
          >
            <code>{toolbar ? `"${toolbarPrompt}"` : "false"}</code>
          </MetaRow>
        </dl>
      ) : (
        <PropValues
          label={
            state === "direct-change"
              ? footerLabelChange.after
              : footerLabelChange.before
          }
        />
      )}
      <div className="ce-detail-links">
        <MockLink
          to={
            toolbar
              ? "design/components/pages/toolbar"
              : help
                ? "design/components/pages/help"
                : "design/components/overview"
          }
        >
          Open component ↗
        </MockLink>
        {toolbar || help || consumer ? (
          <button className="ce-text-button" type="button" disabled={help}>
            Highlight on screen
          </button>
        ) : (
          <MockLink
            to={
              nested
                ? "design/components/inspection/inspection-nested"
                : "design/components/inspection/inspection-highlight"
            }
          >
            Highlight on screen
          </MockLink>
        )}
      </div>
      {help ? <p className="ce-muted">No visible region</p> : null}
      <details className="ce-slot-details">
        <summary>Slots and ownership</summary>
        <p>
          Supplied by{" "}
          {nested ? "Main toolbar" : consumer ? "Details" : "Welcome"}. No slots
          supplied.
        </p>
      </details>
    </section>
  );
}
