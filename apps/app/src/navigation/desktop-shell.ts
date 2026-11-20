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
