import { MockLink } from "@mokly/mokly";

import type { ArtboardViewport } from "../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../parts/stage.js";

import { footerLabelChange } from "./comparison_fixtures.js";
import { HighlightMask, type InspectionSelection } from "./highlight.js";
import { ActionExample, ToolbarExample } from "./preview.js";
import { PreviewScheme } from "./view_controls.js";

export type ScreenPageState =
  | "closed"
  | "toolbar-selection"
  | "help-selection"
  | "details"
  | "highlight"
  | "nested"
  | "direct-change"
  | "consumer"
  | "empty"
  | "unavailable"
  | "inspection-loading"
  | "removed-consumer";

/** A single consumer screen reused by Current, inspection, and comparison mockups. */
export function WelcomeExample({
  directChange = false,
  selection = "off",
}: {
  directChange?: boolean;
  selection?: InspectionSelection;
}) {
  return (
    <div className="ce-welcome-example">
      <h2>Welcome</h2>
      <div className="ce-demo-toolbar">
        <ToolbarExample />
      </div>
      <div className="ce-demo-content">
        <h3>Your next step starts here</h3>
        <p>Choose an action to continue.</p>
      </div>
      <div className="ce-demo-footer">
        <ActionExample
          label={
            directChange ? footerLabelChange.after : footerLabelChange.before
          }
        />
      </div>
      <HighlightMask selection={selection === "off" ? "outer" : selection} />
    </div>
  );
}

export function ConsumerFrame({
  state,
  viewport,
}: {
  state: ScreenPageState;
  viewport: ArtboardViewport;
}) {
  const content =
    state === "consumer" ? (
      <div className="ce-other-example">
        <h2>Details</h2>
        <p>Everything you need for your next step.</p>
        <div className="ce-single-action">
          <ActionExample />
          <MockLink
            className="ce-single-highlight ce-highlight-layer"
            to="design-component-inspection-consumer"
            aria-label="Inspect Action, Continue"
          >
            <span>Action · Continue</span>
          </MockLink>
        </div>
      </div>
    ) : state === "empty" || state === "unavailable" ? (
      <div className="ce-other-example">
        <h2>Reading room</h2>
        <p>A quiet place to pick up where you left off.</p>
      </div>
    ) : state === "removed-consumer" ? (
      <div className="ce-other-example">
        <h2>Farewell</h2>
        <p>Come back whenever you are ready.</p>
        <ActionExample before />
      </div>
    ) : (
      <WelcomeExample
        directChange={state === "direct-change"}
        selection={
          state === "highlight"
            ? "outer"
            : state === "nested"
              ? "nested"
              : "off"
        }
      />
    );
  return (
    <>
      <p className="mbk-frame-label">
        {viewport === "mobile" ? "Mobile" : "Desktop"} · <PreviewScheme />
      </p>
      {viewport === "mobile" ? (
        <PhoneFrame small>{content}</PhoneFrame>
      ) : (
        <BrowserFrame
          address={`example.test/${state === "consumer" ? "details" : state === "removed-consumer" ? "farewell" : state === "empty" || state === "unavailable" ? "reading-room" : "welcome"}`}
        >
          {content}
        </BrowserFrame>
      )}
    </>
  );
}
