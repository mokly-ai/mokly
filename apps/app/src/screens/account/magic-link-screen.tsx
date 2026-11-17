import { useCallback, useState } from "react";

import { Action } from "../../components/action";
import { AppLink } from "../../components/app-link";
import { Field } from "../../components/field";
import { sendMagicLink } from "../../data/auth";
import { useWrite } from "../../settings/write";
import { AccountShell } from "./account-shell";

function ChangeEmail() {
  return (
    <p className="fo-account-switch">
      Wrong address? <AppLink href="/sign-up">Change email</AppLink>
    </p>
  );
}

/**
 * The link has been sent. The screen claims no identity: it names the address
 * the reader typed, resends to it, and offers the way to correct it.
 *
 * Whether a link is outstanding decides which control the reader has, so the
 * two are never on screen together; each still holds its own write, because
 * each answers "is there still something to send" differently — one has
 * already sent the link it was asked for, the other is waiting for an address
 * — and a refused send is reported beside the control that made it rather
 * than in place of the screen.
 */
export function MagicLinkScreen({
  email,
  returnTo,
}: {
  email: string;
  returnTo: string;
}) {
  const [address, setAddress] = useState(email);
  const [sent, setSent] = useState(false);
  const delivered = useCallback(() => setSent(true), []);
  const resend = useWrite(delivered, !sent);
  const send = useWrite(delivered, address.trim().length > 0);

  const again = useCallback(
    () => resend.run(() => sendMagicLink({ email: address.trim(), returnTo })),
    [resend, address, returnTo],
  );
  const first = useCallback(
    () => send.run(() => sendMagicLink({ email: address.trim(), returnTo })),
    [send, address, returnTo],
  );

  // A link is outstanding when the screen was opened for one, and equally when
  // this screen has just sent one: both land the reader on the same
  // composition rather than leaving a successful send with nothing to show.
  const waiting = sent || email.length > 0;
  return (
    <AccountShell
      screen="account-magic-link"
      title="Check your email"
      detail={
        waiting ? (
          <>
            Open the sign-in link sent to{" "}
            <span className="fo-account-address">{address.trim()}</span>.
          </>
        ) : undefined
      }
      identity={{ kind: "link", label: "Sign in", href: "/sign-in" }}
      below={waiting ? <ChangeEmail /> : undefined}
    >
      {waiting ? (
        resend.around(
          <div className="fo-account-actions">
            <Action
              label={resend.label(
                sent ? "Link sent" : "Resend link",
                "Sending…",
              )}
              tone="secondary"
              block
              write={resend}
              operation="Sending sign-in link"
              disabled={resend.disabled}
              onPress={() => void again()}
              testID="resend-link"
            />
          </div>,
        )
      ) : (
        <>
          <Field
            label="Email"
            name="link-email"
            type="email"
            value={address}
            onChange={setAddress}
            disabled={send.working}
          />
          {send.around(
            <div className="fo-account-actions">
              <Action
                label={send.label("Send sign-in link", "Sending…")}
                tone="primary"
                block
                write={send}
                operation="Sending sign-in link"
                disabled={send.disabled}
                onPress={() => void first()}
                testID="send-link"
              />
            </div>,
          )}
        </>
      )}
    </AccountShell>
  );
}
