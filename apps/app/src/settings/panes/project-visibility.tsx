import { useCallback } from "react";
import type { ReactNode } from "react";

import type { Project } from "../../api/types";
import { Action } from "../../components/action";
import { PlanConsequence } from "../../components/plan-consequence";
import { updateProject } from "../../data/projects";
import { useSettings } from "../context";
import { SettingsModal } from "../modal";
import { alwaysSendable, useWrite } from "../write";

/**
 * Changing who can open the project's publications, asked over the pane. It is
 * its own write with its own control, and it sends the saved name rather than
 * the name field: a visibility change must never publish a rename the reader
 * has not saved.
 */
export function ChangeVisibility({
  project,
  onClose,
  onChanged,
}: {
  project: Project;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { workspace } = useSettings();
  const next = project.visibility === "private" ? "public" : "private";
  const publish = useWrite(
    useCallback(() => {
      onClose();
      onChanged();
    }, [onClose, onChanged]),
    alwaysSendable,
  );
  const change = useCallback(
    () =>
      publish.run(() =>
        updateProject(project.id, {
          name: project.name,
          slug: project.slug,
          visibility: next,
          requireApproval: project.requireApproval,
          version: project.version,
        }),
      ),
    [
      next,
      project.id,
      project.name,
      project.slug,
      project.requireApproval,
      project.version,
      publish,
    ],
  );
  const planRefused = publish.error?.reason === "plan-required";
  const confirmationControls = (wayOn?: ReactNode) => (
    <div className="review-inline">
      <Action
        label={publish.label(
          next === "public" ? "Make public" : "Make private",
          next === "public" ? "Making public…" : "Making private…",
        )}
        tone="primary"
        size="md"
        write={publish}
        operation={
          next === "public"
            ? `Making ${project.name} public`
            : `Making ${project.name} private`
        }
        disabled={publish.disabled}
        onPress={() => void change()}
        testID="confirm-visibility"
      />
      <Action
        label={
          project.visibility === "private" ? "Keep private" : "Keep public"
        }
        tone="quiet"
        size="md"
        disabled={publish.working}
        onPress={onClose}
      />
      {wayOn}
    </div>
  );
  return (
    <SettingsModal
      title={
        next === "public"
          ? `Make ${project.name} public?`
          : `Make ${project.name} private?`
      }
      onClose={onClose}
      dismissible={!publish.working}
      testID="visibility-modal"
    >
      <span className="fo-note-detail">
        {next === "public"
          ? "Anyone with the link will be able to open this project’s publications."
          : "Only project members will be able to open this project’s publications."}
      </span>
      {publish.around(
        planRefused ? (
          <PlanConsequence
            canUpgrade={workspace?.role === "owner"}
            to="billing"
            size="md"
          >
            {({ action, message }) => (
              <>
                {confirmationControls(action)}
                {message && <p className="fo-copy">{message}</p>}
              </>
            )}
          </PlanConsequence>
        ) : (
          confirmationControls()
        ),
      )}
    </SettingsModal>
  );
}
