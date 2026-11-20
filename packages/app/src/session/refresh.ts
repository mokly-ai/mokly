import type { ApiError } from "../api/errors";
import type { Session } from "../api/types";

import type { SessionState } from "./context";

/** What one quiet read of the session answered: the session, or why not. */
export type SessionRead =
  { session: Session } | { error: ApiError | undefined };

/**
 * The session state after a quiet read, one that nobody pressed for, such as
 * the desktop app's window reading again when it gets focus. A session that
 * changed replaces the held one, and an unchanged one keeps the very state on
 * screen, so nothing renders again for it. An authentication refusal signs the
 * reader out. Any other failure keeps what is on screen, because a read the
 * reader did not ask for must not replace their page with an error. Before the
 * first answer, a failure uses the start-up outcome so loading always ends.
 */
export function afterRefresh(
  current: SessionState,
  read: SessionRead,
): SessionState {
  if ("session" in read) {
    return current.status === "signed-in" &&
      JSON.stringify(current.session) === JSON.stringify(read.session)
      ? current
      : { status: "signed-in", session: read.session };
  }
  if (current.status === "loading") {
    return read.error && !read.error.signedOut
      ? { status: "error", error: read.error }
      : { status: "signed-out" };
  }
  if (!read.error?.signedOut) return current;
  return current.status === "signed-out" ? current : { status: "signed-out" };
}
