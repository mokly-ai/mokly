import { stateScreenPath } from "../../../fixtures/product-states";
import { Action } from "../page-parts";

import { AccountShell } from "./account-shell";
import { entryCopy } from "./entry-layout";
import type { EntryMode } from "./entry-layout";

/**
 * The window's entry before the reader leaves for the browser, and while the
 * browser page is open and the window waits for the grant.
 */
export type DesktopEntryState = "default" | "waiting";

/**
 * Sign in and sign up in the desktop app's window. The window cannot use the
 * browser's sign-ins, so it draws no email field and no GitHub action: its
 * one action opens the connect page in the browser, which offers every way in,
 * so there is no switch to the other entry screen either. Waiting keeps the
 * same panel, and its action opens the same page again, so a grant from either
 * browser tab signs the window in. Both actions leave the app, so each carries
 * the external glyph. The window is signed out, so the header names nobody.
 */
export function DesktopEntryPage({
  mode,
  state,
  screen,
  macApp,
}: {
  mode: EntryMode;
  state: DesktopEntryState;
  /** The path of a drawing of this entry that names itself. */
  screen?: string;
  /** Whether the page draws the Mac app window around the account canvas. */
  macApp?: boolean;
}) {
  const waiting = state === "waiting";
  return (
    <AccountShell
      id={
        screen ?? stateScreenPath("product/account/" + mode + "/desktop", state)
      }
      macApp={macApp}
      title={waiting ? "Check your browser" : entryCopy[mode].title}
      identity={entryCopy[mode].identity}
    >
      <div className="fo-account-actions">
        <Action
          label={waiting ? "Open browser again" : "Continue in browser"}
          to="product/account/connect-desktop"
          tone="primary"
          icon="external"
          block
        />
      </div>
    </AccountShell>
  );
}
