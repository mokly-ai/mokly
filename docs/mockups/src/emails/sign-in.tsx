/**
 * The sign-in message: one link that opens a session, and the two sentences a
 * reader needs about it. The same copy writes the HTML body and the plain-text
 * alternative, so neither can drift from the other.
 */

import type { SignInContent } from "./content";
import { ActionRow, ExpiryRow, FallbackRow, HeadingRow } from "./document";
import type { EmailBodyRenderProps, EmailDefinition } from "./document";

const subject = "Sign in to Mokly";
const action = "Sign in";
const ignore = "If you didn’t request it, ignore this email.";

function expiry(content: SignInContent): string {
  return "The link is valid for " + content.expiry + " and works once.";
}

function SignInBody({ content, styles }: EmailBodyRenderProps<SignInContent>) {
  return (
    <>
      <HeadingRow styles={styles}>{subject}</HeadingRow>
      <ActionRow href={content.link} label={action} styles={styles} />
      <FallbackRow href={content.link} styles={styles} />
      <ExpiryRow styles={styles}>{expiry(content)}</ExpiryRow>
      <ExpiryRow styles={styles}>{ignore}</ExpiryRow>
    </>
  );
}

/** The sign-in message, over its own typed content. */
export const signInEmail: EmailDefinition<SignInContent> = {
  Body: SignInBody,
  kind: "sign-in",
  preheader: (content) =>
    "Your sign-in link is valid for " + content.expiry + ".",
  subject: () => subject,
  text: (content) =>
    [subject, action + ": " + content.link, expiry(content), ignore].join(
      "\n\n",
    ),
};
