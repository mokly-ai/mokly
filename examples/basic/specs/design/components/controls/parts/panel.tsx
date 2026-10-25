import { MockLink } from "@mokly/mokly";

import { ActionPropValues, actionEntries } from "../../parts/action_props.js";

import { CONTROLS_COPY } from "./copy.js";
import { ControlFields } from "./fields.js";
import {
  controlsFixtures,
  isPublished,
  type ControlsState,
} from "./fixtures.js";

export function ControlsPanel({ state }: { state: ControlsState }) {
  const fixture = controlsFixtures[state];
  const variant = actionEntries[fixture.variant];
  const readonly = isPublished(state) || state === "comparison";
  const preparing = state === "preparing" || state === "preparing-failed";
  return (
    <section className="ce-controls-content">
      <div className="ce-controls-heading">
        <div>
          <h3>
            {readonly ? CONTROLS_COPY.readonlyHeading : CONTROLS_COPY.heading}
          </h3>
          <p>
            {variant.title}
            {fixture.edited ? (
              <>
                {/* The space keeps the title and the badge two words. */}{" "}
                <span className="ce-edited">{CONTROLS_COPY.edited}</span>
              </>
            ) : readonly ? null : (
              ` · ${CONTROLS_COPY.saved}`
            )}
          </p>
        </div>
        {!readonly ? (
          fixture.edited ? (
            <MockLink
              className="ce-reset"
              to="design/components/controls/editing/reset"
            >
              {CONTROLS_COPY.reset(variant.title)}
            </MockLink>
          ) : (
            <button className="ce-reset" type="button" disabled>
              {CONTROLS_COPY.reset(variant.title)}
            </button>
          )
        ) : null}
      </div>
      {readonly ? (
        <>
          <p className="ce-controls-notice">
            {state === "comparison"
              ? CONTROLS_COPY.comparison
              : CONTROLS_COPY.published}
          </p>
          {state === "comparison" ? (
            <MockLink
              className="ce-detail-links"
              to="design/components/controls/controls/default"
            >
              {CONTROLS_COPY.switchToCurrent}
            </MockLink>
          ) : null}
          <ActionPropValues props={fixture.draft} />
        </>
      ) : (
        <>
          {state === "error" ? (
            <div className="ce-control-alert" role="alert">
              <strong>{CONTROLS_COPY.failedTitle}</strong>
              <p>{CONTROLS_COPY.failedBody}</p>
              <MockLink to="design/components/controls/states/pending">
                {CONTROLS_COPY.retry}
              </MockLink>
            </div>
          ) : null}
          {state === "invalid" ? (
            <p className="ce-control-alert" role="alert">
              {CONTROLS_COPY.invalid}
            </p>
          ) : null}
          {state === "invalid-together" ? (
            <p className="ce-control-alert" role="alert">
              {CONTROLS_COPY.invalidTogether}
            </p>
          ) : null}
          {state === "expired" ? (
            <div className="ce-control-alert" role="alert">
              <strong>{CONTROLS_COPY.expiredTitle}</strong>
              <p>{CONTROLS_COPY.expiredBody}</p>
              <MockLink to="design/components/controls/states/pending">
                {CONTROLS_COPY.expiredAction}
              </MockLink>
            </div>
          ) : null}
          {state === "reset" ? (
            <p className="ce-reset-status" role="status">
              {CONTROLS_COPY.restored}
            </p>
          ) : null}
          {state === "preparing" ? (
            <p className="ce-controls-notice" role="status">
              {CONTROLS_COPY.preparing}
            </p>
          ) : null}
          {state === "preparing-failed" ? (
            <p className="ce-control-alert" role="alert">
              {CONTROLS_COPY.preparingFailed}{" "}
              <MockLink to="design/components/controls/states/preparing">
                {CONTROLS_COPY.retry}
              </MockLink>
            </p>
          ) : null}
          {preparing ? (
            <fieldset className="ce-control-fieldset" disabled>
              <ControlFields props={fixture.draft} invalid={false} />
            </fieldset>
          ) : (
            <ControlFields
              props={fixture.draft}
              invalid={state === "invalid"}
            />
          )}
        </>
      )}
    </section>
  );
}
