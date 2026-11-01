import { CompareGrid, ComparisonView, Pane } from "../../parts/compare.js";
import { FramedShot } from "../../parts/compare_page.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../parts/stage.js";

import { footerLabelChange } from "./comparison_fixtures.js";
import { HighlightLayer } from "./highlight.js";
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

/**
 * A single consumer screen reused by Current, inspection, and comparison
 * mockups. Its fixed layout draws each instance at the box of its highlight
 * region, so the depicted view's highlight lies over it.
 */
export function WelcomeExample({
  actionBefore = false,
  directChange = false,
  outsideAction = false,
  viewport,
}: {
  /** Draws every Action that Welcome uses as the branch point renders it. */
  actionBefore?: boolean;
  directChange?: boolean;
  /** Welcome's own link that reuses the action's style outside Action. */
  outsideAction?: boolean;
  /** The viewport whose regions the depicted view's highlight draws. */
  viewport: ArtboardViewport;
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
      <HighlightLayer viewport={viewport} />
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
        <Pane side="before">
          <FramedShot address="example.test/welcome" viewport={viewport}>
            <WelcomeExample actionBefore viewport={viewport} />
          </FramedShot>
        </Pane>
        <Pane side="after">
          <FramedShot address="example.test/welcome" viewport={viewport}>
            <WelcomeExample viewport={viewport} />
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
  const content =
    state === "consumer" ? (
      <div className="ce-other-example ce-consumer-example">
        <h2>Details</h2>
        <p>Everything you need for your next step.</p>
        <ActionExample />
        <HighlightLayer viewport={viewport} />
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
        viewport={viewport}
      />
    );
  return viewport === "mobile" ? (
    <PhoneFrame small>{content}</PhoneFrame>
  ) : (
    <BrowserFrame
      address={`example.test/${state === "consumer" ? "details" : state === "removed-consumer" ? "farewell" : state === "empty" || state === "unavailable" ? "reading-room" : "welcome"}`}
    >
      {content}
    </BrowserFrame>
  );
}
