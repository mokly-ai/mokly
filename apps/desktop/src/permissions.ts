import type { Session } from "electron";
import { isDesktopAddress } from "./origin.js";

/** Only the bundled main frame may write sanitized text to the clipboard. */
export function permissionAllowed(
  permission: string,
  isMainFrame: boolean,
  address: string,
): boolean {
  if (permission !== "clipboard-sanitized-write" || !isMainFrame) return false;
  try {
    return isDesktopAddress(new URL(address));
  } catch {
    return false;
  }
}

/** Apply the same frame and origin boundary to permission requests and checks. */
export function installPermissions(
  session: Pick<
    Session,
    "setPermissionRequestHandler" | "setPermissionCheckHandler"
  >,
): void {
  session.setPermissionRequestHandler(
    (_contents, permission, callback, details) =>
      callback(
        permissionAllowed(
          permission,
          details.isMainFrame,
          details.requestingUrl,
        ),
      ),
  );
  session.setPermissionCheckHandler((_contents, permission, origin, details) =>
    permissionAllowed(permission, details.isMainFrame, origin),
  );
}
