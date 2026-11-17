import { one } from "./provider-query";

/**
 * The origin the desktop shell serves this export from. `mkc_domain` owns the
 * literal, and `fixtures/desktop-origin.json` pins this copy to it.
 */
export const desktopOrigin = "mokly-app://desktop";

/** The location protocol of every page the desktop shell serves. */
const desktopProtocol = desktopOrigin.slice(0, desktopOrigin.indexOf("//"));

/**
 * Whether this page runs inside the desktop shell, read from the page's own
 * location protocol. Server rendering, the logic tests, and iOS and Android,
 * whose `window` has no location, are never the shell.
 */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined" || window.location === undefined) {
    return false;
  }
  return window.location.protocol === desktopProtocol;
}

/** The one query the API puts on an email link the desktop shell requested. */
export const desktopClient = { key: "client", value: "desktop" } as const;

/**
 * Whether an email landing hands its token to the desktop shell rather than
 * exchanging it: the shell requested the link, so the API put `client=desktop`
 * on it, and this page is not the shell. Inside the shell the query means
 * nothing and the landing exchanges the token as usual.
 */
export function offersDesktopHandoff(search: string): boolean {
  return (
    !isDesktopShell() &&
    one(new URLSearchParams(search), desktopClient.key) === desktopClient.value
  );
}

/**
 * The scheme address that hands an email token to the desktop shell: the
 * email landing on the `mokly` scheme `app.json` declares, with the token in
 * the fragment, which is exactly the address the shell accepts.
 */
export function desktopHandoffAddress(token: string): string {
  const fragment = new URLSearchParams({ token }).toString();
  return "mokly://auth/email/callback#" + fragment;
}
