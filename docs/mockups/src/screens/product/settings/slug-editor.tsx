import type { Viewport } from "@mokly/mokly";

import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { addresses, workspace, project } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  failureReference,
  slugEdits,
  slugRefusals,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { Action, AddressPreview } from "../page-parts";
import { SettingsSurface } from "./surface";

type Subject = "workspace" | "project";

const details = {
  workspace: {
    current: workspace.slug,
    draft: slugEdits.workspace.draft,
    label: "Workspace slug",
    pane: "workspace",
    prefix: addresses.root,
    refusal: slugRefusals.workspaceTaken,
    title: "Workspace address",
  },
  project: {
    current: project.slug,
    draft: slugEdits.project.draft,
    label: "Project slug",
    pane: "project",
    prefix: addresses.workspace,
    refusal: slugRefusals.projectTaken,
    title: "Project address",
  },
} as const;

/** Shared form composition; each subject owns a separate screen component. */
export function SlugEditor({
  subject,
  state,
  viewport,
  conflict = false,
  reserved = false,
  screen,
}: {
  subject: Subject;
  state: ScreenState;
  viewport: Viewport;
  conflict?: boolean;
  reserved?: boolean;
  screen?: string;
}) {
  const detail = details[subject];
  const pending = state === "loading";
  const invalid = state === "empty";
  const refused = state === "error";
  const value = invalid ? "" : detail.draft;
  const error = invalid
    ? slugRefusals.slugFormat
    : reserved
      ? slugRefusals.workspaceReserved
      : refused
        ? detail.refusal
        : undefined;
  const save = (
    <Action
      label={pending ? "Saving…" : conflict ? "Reopen" : "Save changes"}
      tone="primary"
      size="md"
      disabled={invalid}
      busy={pending ? "Saving " + subject + " address" : undefined}
    />
  );

  return (
    <SettingsSurface
      pane={detail.pane}
      state={state}
      viewport={viewport}
      title={detail.title}
      screen={
        screen ??
        stateScreenPath("product/settings/" + subject + "/slug", state)
      }
    >
      <div className="fo-form">
        <Input
          label={detail.label}
          name={subject + "-slug"}
          type="identifier"
          value={value}
          // The registered input refuses an `undefined` value, so a field
          // with nothing to refuse leaves the prop out.
          {...(error === undefined ? {} : { error })}
          disabled={pending}
        />
        <AddressPreview address={detail.prefix + "/" + value} />
        <p className="fo-copy">Old links keep working.</p>
        {refused || reserved ? (
          <WriteFailure
            moklyInstance={subject + "-slug-refusal"}
            reference={failureReference}
            control={save}
          />
        ) : conflict ? (
          <WriteFailure
            moklyInstance={subject + "-slug-conflict"}
            cause={slugRefusals.versionConflict}
            reference={failureReference}
            control={save}
          />
        ) : (
          <div>{save}</div>
        )}
      </div>
    </SettingsSurface>
  );
}
