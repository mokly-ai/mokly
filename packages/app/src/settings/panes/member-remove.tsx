import { useCallback } from "react";

import type { Member, Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { removeMember } from "../../data/workspaces";
import { SettingsModal } from "../modal";
import { alwaysSendable, useWrite } from "../write";

/**
 * Losing access asked over the person it concerns. The question names what
 * they lose, because that is the consequence the reader is consenting to, and
 * the control names who it removes unless the only name they have is an
 * address, which no label holds at 320px and the title already carries.
 */
export function RemoveMember({
  member,
  workspace,
  onClose,
  onRemoved,
}: {
  member: Member;
  workspace: Workspace;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const removal = useWrite(
    useCallback(() => {
      onClose();
      onRemoved();
    }, [onClose, onRemoved]),
    alwaysSendable,
  );
  const resting =
    member.name === member.email ? "Remove" : "Remove " + member.name;
  return (
    <SettingsModal
      title={"Remove " + member.name + "?"}
      onClose={onClose}
      dismissible={!removal.working}
      testID="remove-member-modal"
    >
      <span className="fo-note-detail">
        {member.name} loses access to this workspace’s projects.
      </span>
      {removal.around(
        <div className="review-inline">
          <Action
            label={removal.label(resting, "Removing…")}
            tone="danger"
            size="md"
            write={removal}
            operation="Removing member"
            onPress={() =>
              void removal.run(() =>
                removeMember(workspace.id, member.id, member.version),
              )
            }
            testID="confirm-remove-member"
          />
          <Action
            label="Keep access"
            tone="quiet"
            size="md"
            disabled={removal.working}
            onPress={onClose}
          />
        </div>,
      )}
    </SettingsModal>
  );
}
