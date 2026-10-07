import {
  MoklyVersionError,
  VERSION_ERROR_MESSAGE,
} from "../catalogue/version_error.js";

/** Keep the server document usable when its bundled or hosted viewer is incompatible. */
export function reportVersionFailure(doc: Document, error: unknown): boolean {
  if (!(error instanceof MoklyVersionError)) return false;
  if (!doc.querySelector("[data-mokly-version-error]")) {
    const notice = doc.createElement("p");
    notice.setAttribute("role", "alert");
    notice.setAttribute("data-mokly-version-error", "");
    notice.className = "mbk-empty";
    notice.textContent = VERSION_ERROR_MESSAGE;
    (doc.getElementById("mb-main") ?? doc.body).prepend(notice);
  }
  doc.defaultView?.console.warn(VERSION_ERROR_MESSAGE, error.message);
  return true;
}
