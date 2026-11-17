import { roleLabel } from "../../api/labels";
import type { Member } from "../../api/types";
import { Action } from "../../components/action";
import { PersonAvatar, StatusBadge } from "../../components/controls";
import {
  MemberRowPlaceholder,
  NoteRowPlaceholder,
} from "../../components/placeholder-rows";
import { ControlPlaceholder } from "../../components/placeholders";
import { alwaysSendable, nothingToDo, useWrite } from "../write";
import { BadgePlaceholder } from "./row-placeholders";

/** The roles an invitation may carry, in the order the catalogue draws them. */
export const inviteRoles = [
  { label: "Reviewer", value: "reviewer" },
  { label: "Member", value: "member" },
  { label: "Admin", value: "admin" },
] as const;

/** The role an invitation or a role change may set. */
export type InviteRole = (typeof inviteRoles)[number]["value"];

/** Whether a value names a role this form may set. */
export function isInviteRole(value: string): value is InviteRole {
  return inviteRoles.some((role) => role.value === value);
}

/** The diameter in px of a person's avatar in the members list. */
const avatarSize = 28;

/** The width in px of Revoke invitation at the row's action size. */
const revokeInvitationWidth = 150;

/** The active people in one workspace, each openable for management. */
export function MemberRows({
  members,
  onSelect,
}: {
  members: readonly Member[];
  onSelect: (member: Member) => void;
}) {
  return (
    <div className="fo-member-list">
      {members.map((person) => (
        <div className="fo-member-row" key={person.id}>
          <PersonAvatar name={person.name} size={avatarSize} />
          <div className="fo-person-copy">
            <span className="fo-person-name">
              {person.name === person.email ? person.email : person.name}
            </span>
            {person.name !== person.email && (
              <span className="fo-person-detail">{person.email}</span>
            )}
          </div>
          <span className="review-inline">
            <span className="fo-role">{roleLabel(person.role)}</span>
            <Action
              label="Manage"
              tone="quiet"
              size="sm"
              onPress={() => onSelect(person)}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The people while the members are read: one placeholder row stands for
 * them, with its Manage, whose label is known, drawn disabled.
 */
export function PeopleWait() {
  return (
    <div className="fo-member-list">
      <MemberRowPlaceholder
        avatar={avatarSize}
        control={<Action label="Manage" tone="quiet" size="sm" disabled />}
      />
    </div>
  );
}

/**
 * The invitations while the members are read. The list is often empty, and
 * only a row shows the Invited badge and Revoke invitation, so the placeholder
 * row draws both as placeholders in their own boxes.
 */
export function InvitationsWait() {
  return (
    <NoteRowPlaceholder
      head={<BadgePlaceholder />}
      below={<ControlPlaceholder size="md" width={revokeInvitationWidth} />}
    />
  );
}

/** Invitations still waiting to be accepted, each revocable. */
export function InvitationRows({
  invited,
  revoke,
}: {
  invited: readonly Member[];
  revoke: (member: Member) => Promise<unknown>;
}) {
  if (invited.length === 0) {
    return <p className="fo-copy">No pending invitations.</p>;
  }
  return (
    <>
      {invited.map((person) => (
        <InvitationRow key={person.id} person={person} revoke={revoke} />
      ))}
    </>
  );
}

function InvitationRow({
  person,
  revoke,
}: {
  person: Member;
  revoke: (member: Member) => Promise<unknown>;
}) {
  // The row owns the write, so one invitation being withdrawn says so on its
  // own row and a failure is reported where the reader pressed.
  const withdraw = useWrite(nothingToDo, alwaysSendable);
  return (
    <div className="fo-note">
      <div className="fo-note-head">
        <span className="fo-note-title">{person.email}</span>
        <StatusBadge label="Invited" tone="neutral" dot />
      </div>
      <span className="fo-note-detail">{roleLabel(person.role)}</span>
      {withdraw.around(
        <div>
          <Action
            label={withdraw.label("Revoke invitation", "Revoking…")}
            tone="quiet"
            size="md"
            write={withdraw}
            operation="Revoking invitation"
            disabled={withdraw.disabled}
            onPress={() => void withdraw.run(() => revoke(person))}
            testID="revoke-invitation"
          />
        </div>,
      )}
    </div>
  );
}
