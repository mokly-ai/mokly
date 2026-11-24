import type { ApiError } from "../api/errors";

/**
 * The failure of a sign-out that the account menu sent, which the Account
 * settings pane shows as the failure of its own Sign out when it opens next.
 * It lives in document scope, because the menu belongs to the viewer and the
 * pane to the settings dialog, which mounts after the menu has closed.
 */
let failure: ApiError | undefined;

/** Keep a menu's failed sign-out for the Account pane to show. */
export function keepSignOutFailure(error: ApiError): void {
  failure = error;
}

/** The menu's failed sign-out that no Account pane has shown yet. */
export function signOutFailure(): ApiError | undefined {
  return failure;
}

/** An Account pane has shown it, so the next one opens at rest. */
export function forgetSignOutFailure(): void {
  failure = undefined;
}
