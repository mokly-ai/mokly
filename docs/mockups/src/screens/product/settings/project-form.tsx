import type { ReactNode } from "react";

import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { project, sample } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  billing,
  causes,
  failureReference,
} from "../../../fixtures/product-states";
import { Action, Facts } from "../page-parts";
import { ControlPlaceholder, factPlaceholder, TextBar } from "../placeholders";

/** The widths of the controls whose presence the role decides, in px. */
const changeWidth = 72;
const visibilityWidth = 102;
const saveWidth = 123;

/**
 * The project's facts while the settings scope loads: each text that the
 * project supplies is a bar in its own line box, and Change and the visibility
 * change, which the reader's role decides, wait as placeholders in their own
 * boxes, in the form that the readers who administer the project see.
 */
const waitingFacts: readonly (readonly [string, ReactNode])[] = [
  [
    "Slug",
    <span className="review-inline" key="project-slug">
      <code>
        <TextBar width="7em" />
      </code>
      <ControlPlaceholder size="sm" width={changeWidth} />
    </span>,
  ],
  factPlaceholder("Repository", "11em"),
  [
    "Config",
    <code key="config">
      <TextBar width="9em" />
    </code>,
  ],
  [
    "Visibility",
    <span className="fo-fact-action" key="visibility">
      <TextBar width="3.5em" />
      <ControlPlaceholder size="sm" width={visibilityWidth} />
    </span>,
  ],
];

/**
 * The Project pane's first section: the name, the immutable repository
 * identity, the visibility with the way to change it, and Save. Changing
 * visibility is a write of its own, asked in a modal over the pane, so it
 * stays live while the name is being saved. While the settings scope loads,
 * the name waits in its frame, the facts wait, and Save, which the reader's
 * role decides, waits as a placeholder in its own box.
 */
export function ProjectForm({
  state,
  scopeLoading,
  visibility,
  visibilityScreen,
}: {
  state: ScreenState;
  /** The pane was asked for by its address while the settings scope loads. */
  scopeLoading: boolean;
  /** What the project's visibility fact reads. */
  visibility: string;
  /** The drawing that the visibility change's question opens. */
  visibilityScreen: string;
}) {
  const pending = state === "loading";
  const save = scopeLoading ? (
    <ControlPlaceholder size="md" width={saveWidth} />
  ) : (
    <Action
      label={
        pending ? "Saving…" : state === "error" ? "Try again" : "Save changes"
      }
      tone="primary"
      size="md"
      disabled={state === "empty"}
      busy={pending ? "Saving settings" : undefined}
    />
  );
  return (
    <section className="fo-section fo-section-flush">
      <div className="fo-form">
        <Input
          label="Project name"
          name="project-name"
          type="text"
          {...(scopeLoading
            ? { waiting: true }
            : {
                value: state === "empty" ? "" : sample.project,
                disabled: pending,
              })}
        />
        <Facts
          rows={
            scopeLoading
              ? waitingFacts
              : [
                  [
                    "Slug",
                    <span className="review-inline" key="project-slug">
                      <code>{project.slug}</code>
                      <Action
                        label="Change"
                        to="product/settings/project/slug"
                        tone="quiet"
                        size="sm"
                      />
                    </span>,
                  ],
                  ["Repository", sample.repository],
                  ["Config", <code key="config">{sample.config}</code>],
                  [
                    "Visibility",
                    <span className="fo-fact-action" key="visibility">
                      {visibility}
                      <Action
                        label={
                          visibility === billing.publicVisibility
                            ? "Make private"
                            : "Make public"
                        }
                        // Changing visibility is a write of its own, so it
                        // stays live while the name is being saved.
                        to={visibilityScreen}
                        tone="quiet"
                        size="sm"
                      />
                    </span>,
                  ],
                ]
          }
        />
        {state === "empty" && <p className="fo-copy">No changes to save.</p>}
        {state === "error" ? (
          <WriteFailure
            moklyInstance="project-save-failure"
            cause={causes.busy}
            reference={failureReference}
            control={save}
          />
        ) : (
          <div>{save}</div>
        )}
      </div>
    </section>
  );
}
