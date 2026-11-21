import { asApiError } from "../api/errors";
import type { Session } from "../api/types";
import { createRequestSequence } from "../data/request-sequence";

import type { SessionState } from "./context";
import { afterRefresh } from "./refresh";
import type { SessionRead } from "./refresh";

interface SessionReadDependencies {
  readSession: () => Promise<Session>;
  endSession: () => Promise<void>;
  publish: (state: SessionState) => void;
  setCsrfToken: (token: string) => void;
}

/** Own the session reads, the adopted session and their CSRF token together. */
export function createSessionReadOwner({
  readSession,
  endSession,
  publish,
  setCsrfToken,
}: SessionReadDependencies) {
  let state: SessionState = { status: "loading" };
  const sequence = createRequestSequence();

  const apply = (next: SessionState) => {
    state = next;
    publish(next);
  };

  const read = async (mode: "reload" | "refresh") => {
    const isLatest = sequence.next();
    let answer: SessionRead;
    try {
      answer = { session: await readSession() };
    } catch (caught) {
      answer = { error: asApiError(caught) };
    }
    if (!isLatest()) return;
    if ("session" in answer) setCsrfToken(answer.session.csrfToken);
    else if (answer.error?.signedOut) setCsrfToken("");
    apply(
      afterRefresh(mode === "refresh" ? state : { status: "loading" }, answer),
    );
  };

  return {
    reload: () => read("reload"),
    refresh: () => read("refresh"),
    adopt: (session: Session) => {
      sequence.invalidate();
      setCsrfToken(session.csrfToken);
      apply({ status: "signed-in", session });
    },
    signOut: async () => {
      try {
        await endSession();
      } catch (caught) {
        if (!asApiError(caught)?.signedOut) throw caught;
      }
      sequence.invalidate();
      setCsrfToken("");
      apply({ status: "signed-out" });
    },
  };
}
