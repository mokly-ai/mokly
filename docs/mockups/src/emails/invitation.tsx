/**
 * The invitation: who invited the reader, to what, and the one link that
 * accepts it. The heading names both, so the message is understood before the
 * reader opens anything.
 */

import type { InvitationContent } from "./content";
import {
  ActionRow,
  ExpiryRow,
  FallbackRow,
  HeadingRow,
  TextRow,
} from "./document";
import type { EmailBodyRenderProps, EmailDefinition } from "./document";

const action = "Accept invitation";
const accept = "Sign in with this email address to accept";

function heading(content: InvitationContent): string {
  return content.invitedBy + " invited you to " + content.organization;
}

function expiry(content: InvitationContent): string {
  return "The invitation is valid for " + content.expiry + ".";
}

function InvitationBody({
  content,
  styles,
}: EmailBodyRenderProps<InvitationContent>) {
  return (
    <>
      <HeadingRow styles={styles}>{heading(content)}</HeadingRow>
      <TextRow styles={styles}>{accept + "."}</TextRow>
      <ActionRow href={content.link} label={action} styles={styles} />
      <FallbackRow href={content.link} styles={styles} />
      <ExpiryRow styles={styles}>{expiry(content)}</ExpiryRow>
    </>
  );
}

/** The workspace invitation, over its own typed content. */
export const invitationEmail: EmailDefinition<InvitationContent> = {
  Body: InvitationBody,
  kind: "invitation",
  preheader: (content) =>
    content.invitedBy + " invited you to " + content.organization + ".",
  subject: (content) => "Join " + content.organization + " on Mokly",
  text: (content) =>
    [heading(content), accept + ": " + content.link, expiry(content)].join(
      "\n\n",
    ),
};
