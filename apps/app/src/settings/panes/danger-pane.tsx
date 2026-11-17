import { useCallback } from "react";
import type { ReactNode } from "react";

import type { Project } from "../../api/types";
import { Action } from "../../components/action";
import { Field } from "../../components/field";
import { formFailure } from "../../components/form-failure";
import { Section } from "../../components/page-parts";
import type { SectionTitle } from "../../components/page-parts";
import { deleteProject } from "../../data/projects";
import { useSettings } from "../context";
import { useDraft } from "../dirty";
import { draftKey } from "../drafts";
import { useWrite } from "../write";

/**
 * The Delete project pane's layout, which the pane and its wait both draw:
 * the question that names the project, its consequence, and the confirmation
 * form in the danger frame.
 */
function DangerLayout({
  title,
  field,
  actions,
}: {
  title: SectionTitle;
  field: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="fo-stack">
      <Section
        title={title}
        description="All publications in this project become unavailable. This cannot be undone."
      >
        <div className="fo-note fo-note-danger">
          <div className="fo-form">
            {field}
            {actions}
          </div>
        </div>
      </Section>
    </div>
  );
}

/** Delete the project, confirmed by its own name. */
export function DangerPane({ project }: { project: Project }) {
  const { close, leaveConfirmed } = useSettings();
  // The project's own name costs nothing to lose: a confirmation that
  // already says what it confirms is not a change the reader made.
  const [confirmation, setConfirmation] = useDraft(
    draftKey("project", project.id, "delete-confirmation"),
    "",
    [project.name],
  );

  // Only the project's own name sends anything; anything else the reader types
  // is not a deletion this pane will make.
  const matches = confirmation.trim() === project.name;
  const deletion = useWrite(
    // The reader typed this project's name to confirm; that is their answer,
    // and the deletion cannot be taken back, so nothing is asked again on the
    // way out and nothing unsaved is left behind.
    useCallback(() => leaveConfirmed("/"), [leaveConfirmed]),
    matches,
  );

  const remove = useCallback(
    () =>
      deletion.run(() =>
        deleteProject(project.id, {
          confirmationName: confirmation.trim(),
          version: project.version,
        }),
      ),
    [confirmation, project.id, project.version, deletion],
  );

  const failure = formFailure(deletion, {
    "validation-failed": "confirmationName",
  });
  return (
    <DangerLayout
      title={`Delete ${project.name}?`}
      field={
        <Field
          label={`Type ${project.name} to confirm`}
          name="delete-confirmation"
          type="text"
          value={confirmation}
          onChange={setConfirmation}
          disabled={deletion.working || !project.canAdmin}
          error={failure.on("confirmationName")}
        />
      }
      actions={failure.around(
        <div className="review-inline">
          <Action
            label={failure.label("Delete project", "Deleting…")}
            tone="danger"
            size="md"
            write={deletion}
            operation="Deleting project"
            disabled={deletion.disabled || !project.canAdmin}
            onPress={() => void remove()}
            testID="delete-project"
          />
          <Action label="Keep project" tone="quiet" size="md" onPress={close} />
        </div>,
      )}
    />
  );
}

/**
 * The pane while the settings scope loads. The project's name is the scope's,
 * so the question and the field's label keep their known words beside a bar
 * for it, the field waits in its frame, and both controls, whose labels are
 * known, draw themselves, disabled.
 */
export function DangerWait() {
  return (
    <DangerLayout
      title={{ before: "Delete", bar: "6em" }}
      field={
        <Field
          label={{ before: "Type", bar: "6em", after: "to confirm" }}
          name="delete-confirmation"
          type="text"
          waiting
        />
      }
      actions={
        <div className="review-inline">
          <Action label="Delete project" tone="danger" size="md" disabled />
          <Action label="Keep project" tone="quiet" size="md" disabled />
        </div>
      }
    />
  );
}
