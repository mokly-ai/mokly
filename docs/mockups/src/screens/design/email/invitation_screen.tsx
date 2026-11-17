/** The workspace invitation, as the inbox that receives it shows it. */

import { invitationEmail } from "../../../emails/invitation";
import { invitationContent } from "../../../fixtures/emails";
import { EmailFrame } from "./parts/frame";

/** The invitation email screen. */
export function EmailInvitationScreen() {
  return (
    <EmailFrame
      content={invitationContent}
      email={invitationEmail}
      id="design/email/invitation"
    />
  );
}
