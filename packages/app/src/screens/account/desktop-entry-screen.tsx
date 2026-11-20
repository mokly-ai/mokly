import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Action } from "../../components/action";
import { Pending } from "../../components/page-parts";
import {
  keptDesktopVerifier,
  openConnectPage,
  startDesktopSignIn,
} from "../../navigation/desktop-sign-in";

import { AccountShell } from "./account-shell";
import type { ShellWait } from "./account-shell";
import { entryCopy } from "./entry-copy";
import type { EntryMode } from "./entry-copy";

/** The one action's label: it opens the browser, or opens it again. */
function actionLabel(waiting: boolean): string {
  return waiting ? "Open browser again" : "Continue in browser";
}

/**
 * The window's entry panel, loaded or waiting: the title over the one action.
 * While the tab keeps a verifier, the window waits for its grant and the
 * title says so. While a read runs, `wait` makes the panel the waiting region.
 */
function DesktopEntryLayout({
  mode,
  waiting,
  wait,
  children,
}: {
  mode: EntryMode;
  /** Whether the tab keeps a verifier, so the window waits for its grant. */
  waiting: boolean;
  wait?: ShellWait;
  children: ReactNode;
}) {
  const text = entryCopy[mode];
  return (
    <AccountShell
      screen={"account-" + mode + "-desktop"}
      title={waiting ? "Check your browser" : text.title}
      documentTitle={waiting ? undefined : text.documentTitle}
      identity={{ kind: "none" }}
      wait={wait}
    >
      <div className="fo-account-actions">{children}</div>
    </AccountShell>
  );
}

/**
 * Sign in and sign up in the desktop app's window. The window cannot use the
 * browser's sign-ins, so it draws no email field and no GitHub action: its one
 * action keeps a verifier in this tab and opens the connect page in the
 * browser, which offers every way in, so there is no switch to the other entry
 * screen either. While the tab keeps that verifier the window waits for its
 * grant, and the same action opens the page again with the same challenge, so
 * a grant from either browser tab signs the window in. Both labels leave the
 * app, so each carries the external glyph. The window is signed out, so the
 * header names nobody.
 */
export function DesktopEntryScreen({
  mode,
  returnTo,
}: {
  mode: EntryMode;
  returnTo: string;
}) {
  // The verifier the window waits for a grant for. It is read from the tab, so
  // a reload keeps waiting, because the page opened for it can still answer;
  // the landing takes it, and with it the waiting.
  const [kept, setKept] = useState(keptDesktopVerifier);
  // One open at a time: a second press while a challenge is computed would
  // replace the verifier the first page was opened for.
  const opening = useRef(false);

  const press = useCallback(() => {
    if (opening.current) return;
    opening.current = true;
    const opened =
      kept === undefined
        ? startDesktopSignIn(returnTo)
        : openConnectPage(kept, returnTo).then(() => kept);
    // Only a page without Web Crypto refuses, and no shell is one, so a
    // refusal leaves the screen as it was.
    void opened
      .then(setKept, () => undefined)
      .finally(() => {
        opening.current = false;
      });
  }, [kept, returnTo]);

  const waiting = kept !== undefined;
  return (
    <DesktopEntryLayout mode={mode} waiting={waiting}>
      <Action
        label={actionLabel(waiting)}
        tone="primary"
        icon="external"
        block
        onPress={press}
        testID="desktop-entry"
      />
    </DesktopEntryLayout>
  );
}

/**
 * The window's sign-in wait, which the session guard draws while it sends a
 * signed-out window to sign in: the window's own entry, read from the same
 * tab, with its action drawn disabled, so nothing moves when the entry
 * replaces it. No place of the panel waits for an answer, so the guard's
 * operation is named for screen readers only.
 */
export function DesktopSignInWait() {
  const waiting = keptDesktopVerifier() !== undefined;
  return (
    <DesktopEntryLayout
      mode="sign-in"
      waiting={waiting}
      wait={(panel) => (
        <Pending label="Opening Mokly" labelMode="screen-reader-only">
          {panel(undefined)}
        </Pending>
      )}
    >
      <Action
        label={actionLabel(waiting)}
        tone="primary"
        icon="external"
        block
        disabled
      />
    </DesktopEntryLayout>
  );
}
