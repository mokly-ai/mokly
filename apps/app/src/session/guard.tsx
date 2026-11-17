import { useRouter } from "expo-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import type { Session } from "../api/types";
import { Action } from "../components/action";
import { ErrorDetails } from "../components/error-details";
import { StateMessage } from "../components/page-parts";
import { useSession } from "./context";
import { replaceAddress } from "../navigation/address";
import { signInHref } from "../navigation/destinations";
import { SignInWait } from "../screens/account/entry-screen";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="folio-root fo-account" data-mkc-screen="app-session">
      <main id="main" className="fo-account-main">
        <div className="fo-account-panel">
          <div className="fo-account-content">{children}</div>
        </div>
      </main>
    </div>
  );
}

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
      <Frame>
        <StateMessage
          title="Mokly couldn’t load"
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
      </Frame>
    );
  }
  return <>{children(state.session)}</>;
}
