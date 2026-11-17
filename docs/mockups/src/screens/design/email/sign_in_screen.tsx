/** The sign-in message, as the inbox that receives it shows it. */

import { signInEmail } from "../../../emails/sign-in";
import { signInContent } from "../../../fixtures/emails";
import { EmailFrame } from "./parts/frame";

/** The sign-in email screen. */
export function EmailSignInScreen() {
  return (
    <EmailFrame
      content={signInContent}
      email={signInEmail}
      id="design/email/sign-in"
    />
  );
}
