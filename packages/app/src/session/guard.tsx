import { useRouter } from "expo-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import type { Session } from "../api/types";
import { Action } from "../components/action";
import { ErrorDetails } from "../components/error-details";
import { StateMessage } from "../components/page-parts";
import { replaceAddress } from "../navigation/address";
import { signInHref } from "../navigation/destinations";
import { AccountShell } from "../screens/account/account-shell";
import { SignInWait } from "../screens/account/entry-screen";

import { useSession } from "./context";

/** The failure, which the heading shows and the alert announces. */
const failedTitle = "Mokly couldn’t load";

/**
 * Every product route needs the reader signed in. Signing out sends them to the
 * entry screen with this exact location as the destination to resume, so a
 * private deep link returns to itself.
 *
 * While the session read runs, the route draws its destination's wait, because
 * a signed-in reader is the one who usually arrives. Once the read says the
 * reader is signed out, it draws the sign-in screen's wait until sign in
 * replaces it: that is the screen the reader goes to, and the destination is
 * not theirs to open yet.
 *
 * A read that fails draws the account panel, whose one heading names the
 * failure. The alert announces it for screen readers only rather than repeat
 * it as a second, visible title. Nobody is known while the session is unread,
 * so the header names no one.
 */
export function RequireSession({
  children,
  returnTo,
  waiting,
}: {
  children: (session: Session) => ReactNode;
  /** Pin the intended route while a preceding client transition settles. */
  returnTo?: string;
  /**
   * The destination's waiting layout while the session read runs, with the
   * identity's placeholder in its header.
   */
  waiting: ReactNode;
}) {
  const router = useRouter();
  const { state, reload } = useSession();

  useEffect(() => {
    if (state.status !== "signed-out") return;
    replaceAddress(router, signInHref(returnTo));
  }, [state.status, returnTo, router]);

  if (state.status === "loading") return <>{waiting}</>;
  if (state.status === "signed-out") return <SignInWait />;
  if (state.status === "error") {
    return (
      <AccountShell
        screen="app-session"
        title={failedTitle}
        // The tab's suffix names the product, so the tab's title leaves it out.
        documentTitle="Couldn’t load"
        identity={{ kind: "none" }}
      >
        <StateMessage
          announcement={failedTitle}
          error
          details={<ErrorDetails reference={state.error.requestId} />}
          action={
            <Action
              label="Try again"
              tone="primary"
              size="md"
              icon="retry"
              onPress={reload}
            />
          }
        />
      </AccountShell>
    );
  }
  return <>{children(state.session)}</>;
}
