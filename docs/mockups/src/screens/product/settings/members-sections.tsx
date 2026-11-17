import { Avatar } from "../../../entries/design/avatar.mockup";
import { Badge } from "../../../entries/design/badge.mockup";
import { Input } from "../../../entries/design/input.mockup";
import { Segmented } from "../../../entries/design/segmented.mockup";
import { roles } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  billing,
  membership,
  unnamedMember,
} from "../../../fixtures/product-states";
import { Action } from "../page-parts";
import { MemberRowPlaceholder, NoteRowPlaceholder } from "../placeholder-rows";
import { ControlPlaceholder, TextBar } from "../placeholders";
import { BadgePlaceholder } from "./row-placeholders";

/**
 * The parts of the members pane: who is in the workspace, the invitations
 * still open, the invite form and the person the reader manages. While the
 * members are read, each keeps its place and draws its waiting form: a list
 * draws one placeholder row, a control whose label is known draws itself,
 * disabled, and the invite form's field waits in its own frame.
 */

const roleOptions = roles.map((role) => ({ label: role, value: role }));

/** The diameter of a person's avatar in the members list, in px. */
const avatarSize = 28;

/** Anyone this pane lists or has open for management. */
export interface Managed {
  name: string;
  email: string;
  role: string;
  initials: string;
}

/**
 * The drawing that manages one person: the address-only identity has its own,
 * and everyone else is managed on the pane's canonical entry. A row never
 * points at the page it is drawn on, so the list is a way back as well as a
 * way in.
 */
function managedBy(person: Managed, page: string): string | undefined {
  const entry =
    person.email === unnamedMember.email
      ? "product/settings/members/identity"
      : "product/settings/members";
  return entry === page ? undefined : entry;
}

/**
 * Who is in the workspace. Every row opens that person for management,
 * because the pane selects nobody until the reader asks; a person who has not
 * set a name is listed by their address alone, since repeating it beneath
 * itself says nothing. While the list is read, one placeholder row stands for
 * the people, with its Manage drawn disabled.
 */
export function People({
  page,
  waiting = false,
}: {
  page: string;
  waiting?: boolean;
}) {
  return (
    <div className="fo-member-list">
      {waiting ? (
        <MemberRowPlaceholder
          avatar={avatarSize}
          control={
            <Action
              instance="manage-waiting"
              label="Manage"
              tone="quiet"
              size="sm"
              disabled
            />
          }
        />
      ) : (
        membership.active.map((person) => (
          <div className="fo-member-row" key={person.email}>
            <Avatar
              moklyInstance={"member-" + person.initials.toLowerCase()}
              label={person.initials}
              decorative
              tone="soft"
              size={avatarSize}
            />
            <div className="fo-person-copy">
              <span className="fo-person-name">{person.name}</span>
              {person.name !== person.email && (
                <span className="fo-person-detail">{person.email}</span>
              )}
            </div>
            <span className="review-inline">
              <span className="fo-role">{person.role}</span>
              <Action
                instance={"manage-" + person.initials.toLowerCase()}
                label="Manage"
                tone="quiet"
                size="sm"
                to={managedBy(person, page)}
              />
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * One person's role and the way they lose access, inline in the same pane.
 * While Save role's write runs, it is busy, and the role it sends and the
 * removal wait disabled, so neither can change what is being saved.
 */
export function ManagedMember({
  person,
  saving = false,
}: {
  person: Managed;
  /** Save role's write is running, with the role the reader chose. */
  saving?: boolean;
}) {
  return (
    <div className="fo-form">
      <Segmented
        moklyInstance="member-role"
        label={person.name + "’s role"}
        value={saving ? membership.askedRole : person.role}
        options={roleOptions}
        {...(saving ? { disabled: true } : {})}
      />
      <p className="fo-copy">{person.name} keeps inherited workspace access.</p>
      <div className="review-inline">
        <Action
          label={saving ? "Saving…" : "Save role"}
          tone="primary"
          size="md"
          busy={saving ? "Saving role" : undefined}
        />
        {/* The control names who it removes, unless the only name they have is
            an address: the heading above already carries it, and a label that
            long cannot hold the width of a phone. */}
        <Action
          instance="remove-member"
          label={
            person.name === person.email ? "Remove" : "Remove " + person.name
          }
          to="product/settings/members/remove"
          tone="danger"
          size="md"
          disabled={saving}
        />
      </div>
    </div>
  );
}

/** The width of Revoke invitation at the row's action size, in px. */
const revokeInvitationWidth = 150;

/**
 * The invitations still open. The list is often empty, and only a row shows
 * the Invited badge and Revoke invitation, so while they are read, the
 * placeholder row draws both as placeholders in their own boxes. While Revoke
 * invitation's write runs, the row's control is busy and the row stays.
 */
export function Invitations({
  state,
  revoking = false,
}: {
  state: ScreenState;
  /** Revoke invitation's write is running. */
  revoking?: boolean;
}) {
  if (state === "empty")
    return <p className="fo-copy">No pending invitations.</p>;
  if (state === "loading")
    return (
      <NoteRowPlaceholder
        head={<BadgePlaceholder />}
        below={<ControlPlaceholder size="md" width={revokeInvitationWidth} />}
      />
    );
  return (
    <div className="fo-note">
      <div className="fo-note-head">
        <span className="fo-note-title">{membership.invited.email}</span>
        <Badge moklyInstance="invited" label="Invited" tone="neutral" dot />
      </div>
      <span className="fo-note-detail">Reviewer</span>
      <div>
        <Action
          label={revoking ? "Revoking…" : "Revoke invitation"}
          tone="quiet"
          size="md"
          busy={revoking ? "Revoking invitation" : undefined}
        />
      </div>
    </div>
  );
}

/**
 * The invite form. The bill is the material consequence of this write, so the
 * seat the chosen role adds is named beside the control that sends it. While
 * the members are read, the field waits in its own frame, the roles and Send
 * invitation, whose labels are known, draw themselves disabled, and the seat's
 * price, which a read supplies, is a bar in its line. While the invitation is
 * sent, Send invitation is busy, and the address and the role it sends wait
 * disabled.
 */
export function InviteForm({
  waiting = false,
  sending = false,
}: {
  waiting?: boolean;
  /** Send invitation's write is running. */
  sending?: boolean;
}) {
  return (
    <div className="fo-form">
      <Input
        label="Email"
        name="invitation-email"
        type="email"
        {...(waiting
          ? { waiting: true }
          : sending
            ? { value: membership.inviting, disabled: true }
            : { value: "" })}
      />
      <Segmented
        moklyInstance="invite-role"
        label="Invitation role"
        value="Reviewer"
        options={roleOptions}
        {...(waiting || sending ? { disabled: true } : {})}
      />
      {waiting ? (
        <TextBar className="fo-copy" width="min(19em, 100%)" />
      ) : (
        <p className="fo-copy">{billing.collaborators.seat}</p>
      )}
      <div>
        <Action
          label={sending ? "Sending…" : "Send invitation"}
          tone="primary"
          size="md"
          disabled={waiting}
          busy={sending ? "Sending invitation" : undefined}
        />
      </div>
    </div>
  );
}
