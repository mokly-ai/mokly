import { MockLink } from "@mokly/mokly";

import { ActionPropValues, actionVariants } from "../../parts/action_props.js";

import { ControlFields } from "./fields.js";
import {
  controlsFixtures,
  isPublished,
  type ControlsState,
} from "./fixtures.js";

export function ControlsPanel({ state }: { state: ControlsState }) {
  const fixture = controlsFixtures[state];
  const variant = actionVariants[fixture.variant];
  const readonly = isPublished(state) || state === "comparison";
  return (
    <section className="ce-controls-content">
      <div className="ce-controls-heading">
        <div>
          <h3>{readonly ? "Saved props" : "Controls"}</h3>
          <p>
            {variant.title}
            {fixture.edited ? (
              <span className="ce-edited">Edited</span>
            ) : (
              " · Saved values"
            )}
          </p>
        </div>
        {!readonly ? (
          fixture.edited ? (
            <MockLink
              className="ce-reset"
              to="design/components/controls/editing/reset"
            >
              Reset to {variant.title}
            </MockLink>
          ) : (
            <button className="ce-reset" type="button" disabled>
              Reset to {variant.title}
            </button>
          )
        ) : null}
      </div>
      {readonly ? (
        <>
          <p className="ce-controls-notice">
            {state === "comparison"
              ? "Switch to Current to edit props."
              : "Open this catalogue locally to edit props."}
          </p>
          {state === "comparison" ? (
            <MockLink
              className="ce-detail-links"
              to="design/components/controls/controls"
            >
              Switch to Current
            </MockLink>
          ) : null}
          <ActionPropValues props={fixture.draft} />
        </>
      ) : (
        <>
          {state === "error" ? (
            <div className="ce-control-alert" role="alert">
              <strong>Couldn’t update this component</strong>
              <p>
                Your edits are kept. The last working preview is still shown.
              </p>
              <MockLink to="design/components/controls/states/pending">
                Try again
              </MockLink>
            </div>
          ) : null}
          {state === "invalid" ? (
            <p className="ce-control-alert" role="alert">
              Check the highlighted value. The preview keeps its last valid
              values.
            </p>
          ) : null}
          {state === "reset" ? (
            <p className="ce-reset-status" role="status">
              Default values restored.
            </p>
          ) : null}
          <ControlFields props={fixture.draft} invalid={state === "invalid"} />
        </>
      )}
    </section>
  );
}
