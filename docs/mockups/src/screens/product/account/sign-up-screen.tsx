import type { Viewport } from "@mokly/mokly";

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
