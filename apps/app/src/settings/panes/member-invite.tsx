import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { Billing, Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { Choice } from "../../components/controls";
import { Field } from "../../components/field";
import { formFailure } from "../../components/form-failure";
import { TextBar } from "../../components/placeholders";
import { inviteMember } from "../../data/workspaces";
import { useDraft } from "../dirty";
import { draftKey } from "../drafts";
import { useWrite } from "../write";

import { seatConsequence } from "./billing-facts";
import { inviteRoles, isInviteRole } from "./member-rows";
import type { InviteRole } from "./member-rows";

/** The invite form's layout, which the form and its wait both draw. */
function InviteLayout({
  email,
  role,
  seat,
  send,
}: {
  email: ReactNode;
  role: ReactNode;
  seat: ReactNode;
  send: ReactNode;
}) {
  return (
    <div className="fo-form">
      {email}
      {role}
      {seat}
      {send}
    </div>
  );
}

/**
 * The invite form. The bill is the material consequence of this write, so the
 * seat the chosen role adds is named beside the control that sends it.
 */
export function InviteForm({
  workspace,
  costs,
  onInvited,
}: {
  workspace: Workspace;
  /** What the workspace's seats cost, where the reader may read it. */
  costs: Billing | undefined;
  onInvited: () => void;
}) {
  const [email, setEmail] = useDraft(
    draftKey("workspace", workspace.id, "invite-email"),
    "",
  );
  const [role, setRole] = useState<InviteRole>("reviewer");
  const sending = useWrite(onInvited, email.trim().length > 0);
  const seat = seatConsequence(costs, role);

  const invite = useCallback(
    () =>
      sending.run(async () => {
        await inviteMember(workspace.id, { email: email.trim(), role });
        setEmail("");
      }),
    [email, role, workspace.id, sending, setEmail],
  );

  const failure = formFailure(sending, {
    "already-member": "email",
    "validation-failed": "email",
  });
  return (
    <InviteLayout
      email={
        <Field
          label="Email"
          name="invitation-email"
          type="email"
          value={email}
          onChange={setEmail}
          disabled={sending.working}
          error={failure.on("email")}
        />
      }
      role={
        <Choice
          label="Invitation role"
          value={role}
          options={inviteRoles}
          onChange={(next) => {
            if (isInviteRole(next)) setRole(next);
          }}
          disabled={sending.working}
        />
      }
      seat={seat && <p className="fo-copy">{seat}</p>}
      send={failure.around(
        <div>
          <Action
            label={failure.label("Send invitation", "Sending…")}
            tone="primary"
            size="md"
            write={sending}
            operation="Sending invitation"
            disabled={sending.disabled}
            onPress={() => void invite()}
            testID="send-invitation"
          />
        </div>,
      )}
    />
  );
}

/**
 * The invite form while the members are read: the field waits in its frame,
 * the roles and Send invitation, whose labels are known, draw themselves
 * disabled, and the seat's price, which a read supplies, waits as a bar in its
 * line where the form will name one.
 */
export function InviteWait({ seat }: { seat: boolean }) {
  return (
    <InviteLayout
      email={
        <Field label="Email" name="invitation-email" type="email" waiting />
      }
      role={
        <Choice
          label="Invitation role"
          value="reviewer"
          options={inviteRoles}
          onChange={() => undefined}
          disabled
        />
      }
      seat={seat && <TextBar className="fo-copy" width="min(19em, 100%)" />}
      send={
        <div>
          <Action label="Send invitation" tone="primary" size="md" disabled />
        </div>
      }
    />
  );
}
