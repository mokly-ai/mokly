import type { ReactNode } from "react";

import { CompareGrid, MissingPane, Pane } from "../../parts/compare.js";
import { ComparisonStack } from "../../parts/compare_stack.js";
import type { ComparisonMode } from "../../parts/destinations.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import type { ActionProps } from "./action_props.js";
import { ChecklistExample } from "./checklist.js";
import { toolbarPrompt } from "./fixtures.js";
import type { ComponentId } from "./metadata.js";
import { PreviewScheme } from "./view_controls.js";

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

export function ToolbarExample() {
  return (
    <div className="ce-toolbar-example">
      <span>{toolbarPrompt}</span>
      <ActionExample />
    </div>
  );
}

/** The bordered component frame: a context caption above its viewport. */
function ComponentFrame({
  children,
  viewport,
}: {
  children: ReactNode;
  viewport: ArtboardViewport;
}) {
  return (
    <section
      className={`ce-canvas ce-canvas--${viewport}`}
      aria-label={`${viewport === "mobile" ? "Mobile" : "Desktop"} component preview`}
    >
      <span className="ce-canvas-label">
        {viewport} · <PreviewScheme />
      </span>
      {children}
    </section>
  );
}

/** Component canvases keep viewport context without phone or browser decoration. */
export function ComponentCanvas({
  children,
  viewport,
}: {
  children: ReactNode;
  viewport: ArtboardViewport;
}) {
  return (
    <ComponentFrame viewport={viewport}>
      <div className="ce-canvas-content">{children}</div>
    </ComponentFrame>
  );
}

/** The saved variants a comparison depicts; only the Checklist outgrows its frame. */
export type ComparedComponent = Extract<ComponentId, "action" | "checklist">;

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
 * Side by side keeps a bordered frame per version. Overlay and Difference hold
 * both versions in one bordered frame whose viewport they share.
 */
export function ComponentComparison({
  change = "Appearance changed",
  mode = "side-by-side",
  removed = false,
  subject = "action",
  viewport,
}: {
  /** The recorded change the caption names after the compared variant. */
  change?: string;
  mode?: Exclude<ComparisonMode, "current">;
  removed?: boolean;
  subject?: ComparedComponent;
  viewport: ArtboardViewport;
}) {
  return (
    <div className="ce-component-comparison">
      <p className="ce-caption">
        {removed ? "Compact variant removed" : `Default variant · ${change}`}
      </p>
      {mode === "side-by-side" ? (
        <CompareGrid>
          <Pane label="Before" side="before">
            <ComponentFrame viewport={viewport}>
              <ComparedVersion before subject={subject} />
            </ComponentFrame>
          </Pane>
          {removed ? (
            <MissingPane
              label="Current"
              side="after"
              message="This variant has been removed."
            />
          ) : (
            <Pane label="Current" side="after">
              <ComponentFrame viewport={viewport}>
                <ComparedVersion before={false} subject={subject} />
              </ComponentFrame>
            </Pane>
          )}
        </CompareGrid>
      ) : (
        <ComparisonStack
          after={<ComparedVersion before={false} subject={subject} />}
          before={<ComparedVersion before subject={subject} />}
          chrome={(scroller) => (
            <ComponentFrame viewport={viewport}>{scroller}</ComponentFrame>
          )}
          mode={mode}
          scrolled={subject === "checklist"}
        />
      )}
    </div>
  );
}
