import type { ButtonIcon } from "../../components/button";

/**
 * Where a product screen runs: a browser tab on the public app origin, or the
 * desktop app's window. The window cannot use the browser's sign-ins — its
 * GitHub session, saved passwords, passkeys and password-manager extensions —
 * so an action that starts a GitHub trip in a browser tab opens its own page
 * on the web from the window instead, where it applies to the account the
 * browser is signed in to.
 */
export type Host = "browser" | "window";

/**
 * The glyph a GitHub action carries where it runs. In the window it keeps its
 * label and carries the external glyph in place of its own, because it leaves
 * the app.
 */
export function setupGlyph(host: Host, own: ButtonIcon): ButtonIcon {
  return host === "window" ? "external" : own;
}
