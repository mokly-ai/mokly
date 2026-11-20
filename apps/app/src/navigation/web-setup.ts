import { appOrigin } from "../config";

/**
 * Open one of this application's own routes on the public app origin as a
 * popup. The desktop shell opens every popup to that origin in the system
 * browser, so the page there has the browser's own session and sign-ins: the
 * connect page signs the window in from it, and GitHub setup applies to the
 * account the browser is signed in to. `path` is a root-relative application
 * address, with any query it needs.
 */
export function openOnWeb(path: string): void {
  window.open(appOrigin + path, "_blank", "noopener,noreferrer");
}
