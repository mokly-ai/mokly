import type { Viewport } from "@mokly/mokly";

import { DesktopEntryPage } from "./desktop-entry";
import { EntryPage } from "./entry-page";

export function SignUpScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-up" situation="default" />;
}

export function SignUpEmptyScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-up" situation="empty" />;
}

export function SignUpLoadingScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-up" situation="loading" />;
}

export function SignUpErrorScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-up" situation="error" />;
}

/** Continue with GitHub while its write runs, busy until the page leaves. */
export function SignUpGitHubConnectingScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-up" situation="github-connecting" />;
}

export function SignUpGitHubRefusedScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-up" situation="github-refused" />;
}

export function SignUpGitHubOpensSoonScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-up" situation="github-opens-soon" />;
}

export function SignUpAddressRefusedScreen(_props: { viewport: Viewport }) {
  return <EntryPage mode="sign-up" situation="address-refused" />;
}

/** The desktop app's window: one action that opens the connect page. */
export function SignUpDesktopScreen(_props: { viewport: Viewport }) {
  return <DesktopEntryPage mode="sign-up" state="default" />;
}

/** The same window while the connect page is open in the browser. */
export function SignUpDesktopWaitingScreen(_props: { viewport: Viewport }) {
  return <DesktopEntryPage mode="sign-up" state="waiting" />;
}
