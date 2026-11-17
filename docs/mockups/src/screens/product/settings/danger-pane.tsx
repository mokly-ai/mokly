import type { Viewport } from "@mokly/mokly";

import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { sample } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import { causes, failureReference } from "../../../fixtures/product-states";
import { Action, Pending, Section } from "../page-parts";
import { SettingsSurface } from "./surface";

/**
 * The pane's layout, which its loaded drawings and its waits all draw: the
 * question that names the project, its consequence, and the confirmation form
 * in the danger frame. While the settings scope loads, the project's name is
 * not known yet, so the question and the field's label keep their known words
 * beside a bar for it, the field waits in its frame, and both controls, whose
 * labels are known, draw themselves, disabled.
 */
function DangerPane({
  state,
  viewport,
  scopeLoading = false,
}: {
  state: ScreenState;
  viewport: Viewport;
  /** The pane was asked for by its address while the settings scope loads. */
  scopeLoading?: boolean;
}) {
  const pending = state === "loading";
  // The confirmation field holds the project's own name, so a refused deletion
  // is never the reader's text being wrong: the cause belongs above the
  // control that made the write, and that control is the way back.
  const actions = (
    <div className="review-inline">
      <Action
        label={
          pending
            ? "Deleting…"
            : state === "error"
              ? "Try again"
              : "Delete project"
        }
        tone="danger"
        size="md"
        disabled={state === "empty" || scopeLoading}
        busy={pending ? "Deleting project" : undefined}
      />
      <Action
        label="Keep project"
        tone="quiet"
        size="md"
        disabled={scopeLoading}
      />
    </div>
  );
  const layout = (
    <div className="fo-stack">
      <Section
        title={
          scopeLoading
            ? { before: "Delete", bar: "6em" }
            : "Delete " + sample.project + "?"
        }
        description="All publications in this project become unavailable. This cannot be undone."
      >
        <div className="fo-note fo-note-danger">
          <div className="fo-form">
            <Input
              name="delete-confirmation"
              type="text"
              {...(scopeLoading
                ? {
                    label: "Type",
                    labelWaits: { bar: "6em", after: "to confirm" },
                    waiting: true,
                  }
                : {
                    label: "Type " + sample.project + " to confirm",
                    value: state === "empty" ? "" : sample.project,
                    disabled: pending,
                  })}
            />
            {state === "error" ? (
              <WriteFailure
                moklyInstance="delete-project-failure"
                cause={causes.busy}
                reference={failureReference}
                control={actions}
              />
            ) : (
              actions
            )}
          </div>
        </div>
      </Section>
    </div>
  );
  return (
    <SettingsSurface
      pane="danger"
      state={state}
      screen={
        scopeLoading ? "product/settings/danger/scope-loading" : undefined
      }
      viewport={viewport}
      title="Delete project"
    >
      {scopeLoading ? (
        // The scope read has no text place of its own in the pane: each bar
        // stands for the project's name, not for the read, so screen readers
        // hear the read alone.
        <Pending label="Loading settings" labelMode="screen-reader-only">
          {layout}
        </Pending>
      ) : (
        layout
      )}
    </SettingsSurface>
  );
}

export function SettingsDangerScreen({ viewport }: { viewport: Viewport }) {
  return <DangerPane viewport={viewport} state="default" />;
}

export function SettingsDangerEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <DangerPane viewport={viewport} state="empty" />;
}

export function SettingsDangerLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <DangerPane viewport={viewport} state="loading" />;
}

export function SettingsDangerErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <DangerPane viewport={viewport} state="error" />;
}

/**
 * The pane asked for by its address while the settings scope loads: the rail
 * draws the sections that the address's scope gives an owner, and the pane
 * draws its own wait, with a bar for the project's name.
 */
export function SettingsDangerScopeLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <DangerPane viewport={viewport} state="default" scopeLoading />;
}
