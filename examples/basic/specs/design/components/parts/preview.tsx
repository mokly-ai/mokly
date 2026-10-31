import type { ReactNode } from "react";

import {
  ComparisonSurface,
  ComparisonViewport,
  ComponentFrame,
} from "../../../../../../packages/ui/src/comparison-pane/comparison-pane.js";
import { ComparisonSection } from "../../../../../../packages/ui/src/comparison-stage/comparison-stage.js";
import { PreviewFrame } from "../../../../../../packages/ui/src/preview-frame/preview-frame.js";
import { CompareGrid, MissingPane, Pane } from "../../parts/compare.js";
import { ComparisonStack } from "../../parts/compare_stack.js";
import type { ComparisonMode } from "../../parts/destinations.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { COMPONENT_STYLE_COPY } from "../../parts/stylesheet_evidence.js";

import type { ActionProps } from "./action_props.js";
import { ChecklistExample } from "./checklist.js";
import { toolbarPrompt } from "./fixtures.js";
import type { ComponentId } from "./metadata.js";

/** The same synthetic Action is composed by component and consuming-screen designs. */
export function ActionExample({
  before = false,
  disabled = false,
  label = "Continue",
  cornerRadius,
  emphasis,
  hint,
}: {
  before?: boolean;
} & Partial<ActionProps>) {
  return (
    <button
      type="button"
      className={`ce-action${before ? " ce-action--before" : ""}${emphasis === "quiet" ? " ce-action--quiet" : ""}`}
      style={
        cornerRadius === undefined ? undefined : { borderRadius: cornerRadius }
      }
      title={hint}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

/** The Toolbar's prompt and its Action, as the branch point or the head renders them. */
export function ToolbarExample({ before = false }: { before?: boolean }) {
  return (
    <div className="ce-toolbar-example">
      <span>{toolbarPrompt}</span>
      <ActionExample before={before} />
    </div>
  );
}

/**
 * The shipped canvas of a component's Current view: `PreviewFrame` names the
 * viewport above the bordered box that depicts the component's document,
 * without device chrome. The explorer depicts its components in Light only.
 */
export function ComponentCanvas({
  children,
  viewport,
}: {
  children: ReactNode;
  viewport: ArtboardViewport;
}) {
  return (
    <PreviewFrame placement={{ kind: "canvas", viewport }} scheme="light">
      <div className="ce-canvas-content">{children}</div>
    </PreviewFrame>
  );
}

/** The saved variants a comparison depicts; only the Checklist outgrows its frame. */
export type ComparedComponent = Extract<ComponentId, "action" | "checklist">;

/** The recorded state of a compared variant, which its sections name. */
export type ComparedState = "changed" | "removed" | "styles-changed";

/** The shell's heading words for each state, which name a variant. */
const STATE_LABELS: Record<ComparedState, string> = {
  changed: "Variant changed",
  removed: "Variant removed",
  "styles-changed": COMPONENT_STYLE_COPY.stylesChanged,
};

function ComparedVersion({
  before,
  subject,
}: {
  before: boolean;
  subject: ComparedComponent;
}) {
  const version =
    subject === "checklist" ? (
      <ChecklistExample before={before} />
    ) : (
      <ActionExample before={before} />
    );
  return <div className="ce-canvas-content">{version}</div>;
}

/**
 * The shipped chrome of a saved variant's version: the comparison pane's
 * frame around the bordered component frame, whose viewport it is given.
 */
function ComponentChrome({ children }: { children: ReactNode }) {
  return (
    <PreviewFrame placement={{ kind: "pane" }} scheme="light">
      <ComponentFrame>{children}</ComponentFrame>
    </PreviewFrame>
  );
}

/** One version in Side by side: its document on its viewport's surface. */
function PaneVersion({
  before,
  subject,
}: {
  before: boolean;
  subject: ComparedComponent;
}) {
  return (
    <ComponentChrome>
      <ComparisonViewport>
        <ComparisonSurface>
          <ComparedVersion before={before} subject={subject} />
        </ComparisonSurface>
      </ComparisonViewport>
    </ComponentChrome>
  );
}

/**
 * One viewport's shipped section of a saved variant's comparison, headed by
 * its viewport and its state. Side by side keeps one component frame per
 * version. Overlay and Difference hold both versions in one component frame
 * whose viewport they share.
 */
export function ComponentComparison({
  mode = "side-by-side",
  state = "changed",
  subject = "action",
  viewport,
}: {
  mode?: Exclude<ComparisonMode, "current">;
  /** The recorded state, which the section heading names. */
  state?: ComparedState;
  subject?: ComparedComponent;
  viewport: ArtboardViewport;
}) {
  return (
    <ComparisonSection label={STATE_LABELS[state]} viewport={viewport}>
      {mode === "side-by-side" ? (
        <CompareGrid>
          <Pane side="before">
            <PaneVersion before subject={subject} />
          </Pane>
          {state === "removed" ? (
            <MissingPane
              side="after"
              message="This variant has been removed."
            />
          ) : (
            <Pane side="after">
              <PaneVersion before={false} subject={subject} />
            </Pane>
          )}
        </CompareGrid>
      ) : (
        <ComparisonStack
          after={<ComparedVersion before={false} subject={subject} />}
          before={<ComparedVersion before subject={subject} />}
          chrome={(scroller) => <ComponentChrome>{scroller}</ComponentChrome>}
          mode={mode}
          scrolled={subject === "checklist"}
        />
      )}
    </ComparisonSection>
  );
}
