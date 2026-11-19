import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { DesktopGrantResult, User } from "../../api/types";
import { Action } from "../../components/action";
import { Pending, StateMessage } from "../../components/page-parts";
import { issueDesktopGrant } from "../../data/auth";
import {
  desktopGrantAddress,
  reusableGrant,
} from "../../navigation/desktop-sign-in";
import { useSession } from "../../session/context";
import { RequireSession } from "../../session/guard";
import { alwaysSendable, nothingToDo, useWrite } from "../../settings/write";

import { AccountShell } from "./account-shell";
import type { AccountIdentityKind, ShellWait } from "./account-shell";

/**
 * A link without exactly one valid challenge, or a challenge the API refused.
 * Its line is the way on, signing in again from the app, so the state offers
 * nothing to press and discloses no reference.
 */
function InvalidLink({ identity }: { identity: AccountIdentityKind }) {
  return (
    <AccountShell
      screen="account-connect-desktop"
      title="This link isn’t valid"
      identity={identity}
    >
      <StateMessage error>Sign in again from the Mokly app.</StateMessage>
    </AccountShell>
  );
}

/** The invalid link before the page knows who is signed in, if anyone. */
function UncheckedLink() {
  const { state } = useSession();
  return (
    <InvalidLink
      identity={
        state.status === "signed-in"
          ? { kind: "signed-in", user: state.session.user }
          : { kind: "none" }
      }
    />
  );
}

/**
 * The page's panel, loaded or waiting: its title, the line under it and its
 * controls, Open Mokly first. Until the app has the grant, the line names the
 * account the app receives; after that, Open Mokly stands alone. While the
 * session read runs, `wait` makes the panel the waiting region, and the line
 * names the read in place of the account.
 */
function ConnectLayout({
  identity,
  opened,
  line,
  wait,
  children,
}: {
  identity: AccountIdentityKind;
  /** Whether the app has the grant, which retitles the page. */
  opened: boolean;
  line?: ReactNode;
  wait?: ShellWait;
  children: ReactNode;
}) {
  const shell = {
    screen: "account-connect-desktop",
    title: opened ? "Continue in the Mokly app" : "Sign in to the Mokly app",
    documentTitle: opened ? "Continue in the app" : "Sign in to the app",
    identity,
  };
  const controls = <div className="fo-account-actions">{children}</div>;
  return wait ? (
    <AccountShell {...shell} wait={wait} detail={(name) => name}>
      {controls}
    </AccountShell>
  ) : (
    <AccountShell {...shell} detail={line}>
      {controls}
    </AccountShell>
  );
}

/**
 * The page while the session read runs: the confirmation, the layout a
 * signed-in reader gets. Its title and both controls are known, so they draw
 * themselves, disabled, and the header holds the identity's placeholder. The
 * line under the title names the account the session decides, so it names
 * the read in its place.
 */
function ConnectDesktopWait() {
  return (
    <ConnectLayout
      identity={{ kind: "waiting" }}
      opened={false}
      wait={(panel) => <Pending label="Loading your account">{panel}</Pending>}
    >
      <Action
        label="Open Mokly"
        tone="primary"
        icon="external"
        block
        disabled
      />
      <Action label="Use another account" tone="secondary" block disabled />
    </ConnectLayout>
  );
}

/**
 * The signed-in page. It names the account before the app receives it, and
 * requests a grant only when the reader presses Open Mokly, never on load. The
 * grant lives only in memory: the control is the package Button, which
 * renders no anchor, so no `href` shows it and nothing on the page renders it.
 * Later presses hand the app the same grant until it expires, so the shell
 * ignores them as duplicates; a press after that requests a new one. Use
 * another account signs this browser out, and the session guard then replaces
 * the page with sign-in, carrying this page's complete address back.
 */
function Confirmation({
  user,
  challenge,
  returnTo,
}: {
  user: User;
  challenge: string;
  returnTo?: string;
}) {
  const { signOut } = useSession();
  const grant = useRef<DesktopGrantResult | undefined>(undefined);
  const [opened, setOpened] = useState(false);
  // A grant that answers after the page left, or after Use another account
  // began signing the browser out, is never handed to the app: the reader
  // has turned away from the account the page named.
  const mounted = useRef(true);
  const leaving = useRef(false);
  const request = useWrite(nothingToDo, alwaysSendable);
  const signingOut = useWrite(nothingToDo, alwaysSendable);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The browser hands the scheme address to the operating system, and the
  // page stays where it is.
  const handOver = useCallback((held: string) => {
    if (!mounted.current || leaving.current) return;
    window.location.assign(desktopGrantAddress(held));
    setOpened(true);
  }, []);

  const open = useCallback(() => {
    const held = grant.current;
    if (reusableGrant(held, Date.now())) {
      handOver(held.grant);
      return;
    }
    void request.run(async () => {
      const issued = await issueDesktopGrant({ challenge, returnTo });
      grant.current = issued;
      handOver(issued.grant);
    });
  }, [challenge, handOver, request, returnTo]);

  const switchAccount = useCallback(
    () =>
      void signingOut.run(async () => {
        leaving.current = true;
        try {
          await signOut();
        } catch (caught) {
          leaving.current = false;
          throw caught;
        }
      }),
    [signOut, signingOut],
  );

  if (request.error?.reason === "desktop-grant-invalid") {
    return <InvalidLink identity={{ kind: "signed-in", user }} />;
  }
  // The account is named wherever the reader decides between the two
  // controls: before the first press, while a request runs and after one
  // fails. Once the app has the grant, Open Mokly stands alone. While a write
  // runs, its own control carries the wait and the panel inserts nothing.
  const confirming = !opened || request.working || request.error !== undefined;
  return (
    <ConnectLayout
      identity={{ kind: "signed-in", user }}
      opened={!confirming}
      line={
        confirming ? (
          <>
            Signed in as{" "}
            <span className="fo-account-address">{user.email}</span>
          </>
        ) : undefined
      }
    >
      {request.around(
        <Action
          label={request.label("Open Mokly", "Opening…", "Try again")}
          tone="primary"
          icon="external"
          block
          write={request}
          operation="Opening Mokly"
          disabled={request.disabled}
          onPress={open}
          testID="open-mokly"
        />,
      )}
      {confirming &&
        signingOut.around(
          <Action
            label={signingOut.label("Use another account", "Signing out…")}
            tone="secondary"
            block
            write={signingOut}
            operation="Signing you out"
            disabled={signingOut.disabled}
            onPress={switchAccount}
            testID="use-another-account"
          />,
        )}
    </ConnectLayout>
  );
}

/**
 * `/connect/desktop` in the browser: it signs the desktop app in to the
 * browser's account. The challenge is checked before anything else, so a link
 * without exactly one valid challenge shows the invalid state, sends no
 * request and asks nobody to sign in. While the session read runs, the page
 * draws its confirmation's wait. A browser with no session is sent to sign in
 * first, with any method, and comes back to this exact address.
 */
export function ConnectDesktopScreen({
  challenge,
  returnTo,
}: {
  /** The page's one valid challenge, or nothing when its address has none. */
  challenge: string | undefined;
  /** The validated destination the grant carries, when the address names one. */
  returnTo: string | undefined;
}) {
  if (challenge === undefined) return <UncheckedLink />;
  return (
    <RequireSession waiting={<ConnectDesktopWait />}>
      {(session) => (
        <Confirmation
          user={session.user}
          challenge={challenge}
          returnTo={returnTo}
        />
      )}
    </RequireSession>
  );
}
