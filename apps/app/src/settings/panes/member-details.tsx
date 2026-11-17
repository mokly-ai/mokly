import { useCallback, useState } from "react";

import type { Member, Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { Choice } from "../../components/controls";
import { useWrite } from "../write";
import { Facts } from "../../components/page-parts";
import { roleLabel } from "../../api/labels";
import { updateMember } from "../../data/workspaces";
import { inviteRoles, isInviteRole } from "./member-rows";
import type { InviteRole } from "./member-rows";
import { RemoveMember } from "./member-remove";

/**
 * One member's role, and the way they lose access, which is asked in a modal
 * over the pane. The two operations are two writes with two controls: a role
 * change that failed must never leave its way back on the removal, or a
 * removal's on the role, so each owns its own pending, failure and label.
 */
export function MemberDetails({
  member,
  workspace,
  onChanged,
}: {
  member: Member;
  workspace: Workspace;
  onChanged: () => void;
}) {
  // A role this form cannot set is shown rather than silently exchanged for
  // one it can: offering an owner a demotion they did not choose is not the
  // form's decision to make.
  const settable = isInviteRole(member.role) ? member.role : undefined;
  const [role, setRole] = useState<InviteRole>(settable ?? "reviewer");
  const [removing, setRemoving] = useState(false);
  const closeRemoval = useCallback(() => setRemoving(false), []);
  // Nothing to send once the role is back where it started, so an undone
  // input takes its failure with it.
  const changed = role !== member.role;
  const rename = useWrite(onChanged, changed);

  return (
    <div className="fo-form">
      {settable ? (
        <Choice
          label={member.name + "’s role"}
          value={role}
          options={inviteRoles}
          onChange={(next) => {
            if (isInviteRole(next)) setRole(next);
          }}
          disabled={rename.working}
        />
      ) : (
        <Facts rows={[[member.name + "’s role", roleLabel(member.role)]]} />
      )}
      {rename.around(
        <div className="review-inline">
          {settable && (
            <Action
              label={rename.label("Save role", "Saving…")}
              tone="primary"
              size="md"
              write={rename}
              operation="Saving role"
              disabled={rename.disabled}
              onPress={() =>
                void rename.run(() =>
                  updateMember(workspace.id, member.id, {
                    role,
                    version: member.version,
                  }),
                )
              }
              testID="save-role"
            />
          )}
          {/* The control names who it removes, unless the only name they
              have is an address: no label holds one at 320px, and the
              heading above already carries it. */}
          <Action
            label={
              member.name === member.email ? "Remove" : "Remove " + member.name
            }
            tone="danger"
            size="md"
            disabled={rename.working}
            onPress={() => setRemoving(true)}
            testID="remove-member"
          />
        </div>,
      )}
      {removing && (
        <RemoveMember
          member={member}
          workspace={workspace}
          onClose={closeRemoval}
          onRemoved={onChanged}
        />
      )}
    </div>
  );
}
