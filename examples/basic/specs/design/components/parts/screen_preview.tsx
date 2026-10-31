import { MockLink } from "@mokly/mokly";

import { CompareGrid, ComparisonView, Pane } from "../../parts/compare.js";
import { FramedShot } from "../../parts/compare_page.js";
import { useCurrentPage } from "../../parts/design_navigation.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../parts/stage.js";

import { footerLabelChange } from "./comparison_fixtures.js";
import { HighlightMask, type InspectionSelection } from "./highlight.js";
import { ActionExample, ToolbarExample } from "./preview.js";

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
  | "removed-consumer"
  | "style-outside"
  | "affected-screen"
  | "screen-props";

/** A single consumer screen reused by Current, inspection, and comparison mockups. */
export function WelcomeExample({
  actionBefore = false,
  directChange = false,
  inert = false,
  outsideAction = false,
  selection = "off",
}: {
  /** Draws every Action that Welcome uses as the branch point renders it. */
  actionBefore?: boolean;
  directChange?: boolean;
  /** A comparison version: no inspection regions, so it opens nothing. */
  inert?: boolean;
  /** Welcome's own link that reuses the action's style outside Action. */
  outsideAction?: boolean;
  selection?: InspectionSelection;
}) {
  return (
    <div className="ce-welcome-example">
      <h2>Welcome</h2>
      <div className="ce-demo-toolbar">
        <ToolbarExample before={actionBefore} />
      </div>
      <div className="ce-demo-content">
        <h3>Your next step starts here</h3>
        <p>Choose an action to continue.</p>
      </div>
      <div className="ce-demo-footer">
        <ActionExample
          before={actionBefore}
          label={
            directChange ? footerLabelChange.after : footerLabelChange.before
          }
        />
        {outsideAction ? (
          <span className="ce-action ce-outside-action">Not now</span>
        ) : null}
      </div>
      {inert ? null : (
        <HighlightMask selection={selection === "off" ? "outer" : selection} />
      )}
    </div>
  );
}

/**
 * One viewport of Welcome's loaded side-by-side comparison, which Action's
 * Affected screens open. Welcome's own content is unchanged, so its versions
 * differ only inside the Action it uses, and the heading names the changed
 * components.
 */
export function AffectedComparison({
  viewport,
}: {
  viewport: ArtboardViewport;
}) {
  return (
    <ComparisonView state="components-changed" viewport={viewport}>
      <CompareGrid>
        <Pane label="Before" side="before">
          <FramedShot address="example.test/welcome" viewport={viewport}>
            <WelcomeExample actionBefore inert />
          </FramedShot>
        </Pane>
        <Pane label="Current" side="after">
          <FramedShot address="example.test/welcome" viewport={viewport}>
            <WelcomeExample inert />
          </FramedShot>
        </Pane>
      </CompareGrid>
    </ComparisonView>
  );
}

export function ConsumerFrame({
  state,
  viewport,
}: {
  state: ScreenPageState;
  viewport: ArtboardViewport;
}) {
  const current = useCurrentPage();
  const content =
    state === "consumer" ? (
      <div className="ce-other-example">
        <h2>Details</h2>
        <p>Everything you need for your next step.</p>
        <div className="ce-single-action">
          <ActionExample />
          <MockLink
            className="ce-single-highlight ce-highlight-layer"
            to="design/components/inspection/inspection-consumer"
            aria-current={current(
              "design/components/inspection/inspection-consumer",
            )}
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
        outsideAction={state === "style-outside"}
        selection={
          state === "highlight"
            ? "outer"
            : state === "nested"
              ? "nested"
              : "off"
        }
      />
    );
  return viewport === "mobile" ? (
    <PhoneFrame label="Mobile" scheme small>
      {content}
    </PhoneFrame>
  ) : (
    <BrowserFrame
      label="Desktop"
      scheme
      address={`example.test/${state === "consumer" ? "details" : state === "removed-consumer" ? "farewell" : state === "empty" || state === "unavailable" ? "reading-room" : "welcome"}`}
    >
      {content}
    </BrowserFrame>
  );
}
