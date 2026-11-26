import type { Viewport } from "@mokly/mokly";

import { MacWindowLinks } from "../mac-window";

import { DesktopEntryPage } from "./desktop-entry";
import { EntryPage } from "./entry-page";

export function SignInScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" situation="default" />;
}

export function SignInEmptyScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" situation="empty" />;
}

export function SignInLoadingScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" situation="loading" />;
}

export function SignInErrorScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" situation="error" />;
}

/** Continue with GitHub while its write runs, busy until the page leaves. */
export function SignInGitHubConnectingScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" situation="github-connecting" />;
}

export function SignInGitHubRefusedScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" situation="github-refused" />;
}

export function SignInGitHubOpensSoonScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" situation="github-opens-soon" />;
}

export function SignInAddressRefusedScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" situation="address-refused" />;
}

/**
 * Sign in where the configuration answer names a shared account: the password
 * section under the email form, at rest. Every other drawing leaves it off.
 */
export function SignInPasswordScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" password="default" />;
}

/**
 * The section before the reader types: the Email and Password fields are
 * empty, so both of their actions wait disabled.
 */
export function SignInPasswordEmptyScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" password="empty" />;
}

/** The password the API refused, marked on the Password field. */
export function SignInPasswordRefusedScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" password="password-refused" />;
}

/** Continue as the shared account while its write runs. */
export function SignInPasswordSigningInScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" password="signing-in" />;
}

/** The password sign-in refused for another cause, beside its control. */
export function SignInPasswordFailureScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-in" password="failure" />;
}

const macAppPath = "product/account/sign-in/mac-app";

/**
 * Sign in in the Mac app: the desktop app's entry in a window without a title
 * bar. The window buttons sit over the empty start of the account header, and
 * the panel stays where it is.
 */
export function SignInMacAppScreen(_props: { viewport: Viewport }) {
  return (
    <>
      <DesktopEntryPage
        mode="sign-in"
        state="default"
        screen={macAppPath}
        macApp
      />
      <MacWindowLinks current={macAppPath} />
    </>
  );
}

/** The desktop app's window: one action that opens the connect page. */
export function SignInDesktopScreen(_props: { viewport: Viewport }) {
  return <DesktopEntryPage mode="sign-in" state="default" />;
}

/** The same window while the connect page is open in the browser. */
export function SignInDesktopWaitingScreen(_props: { viewport: Viewport }) {
  return <DesktopEntryPage mode="sign-in" state="waiting" />;
}
