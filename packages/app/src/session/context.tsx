import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  api,
  correlationHeader,
  expectBody,
  expectData,
  mutationHeaders,
  setCsrfToken,
} from "../api/client";
import type { ApiError } from "../api/errors";
import type { Session } from "../api/types";
import { onShellFocus } from "../navigation/shell-focus";

import { createSessionReadOwner } from "./read-owner";

/** What the application knows about the reader right now. */
export type SessionState =
  | { status: "loading" }
  | { status: "signed-in"; session: Session }
  | { status: "signed-out" }
  | { status: "error"; error: ApiError };

interface SessionValue {
  state: SessionState;
  reload: () => Promise<void>;
  adopt: (session: Session) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

/**
 * Reads the session once at start-up and keeps the CSRF token the API requires
 * on every mutation beside it. A failure that is not an authentication refusal
 * stays an error state, because signing a reader out on a flaky network would
 * lose their place.
 *
 * One owner applies every read, adoption and sign-out with its CSRF token.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [owner] = useState(() =>
    createSessionReadOwner({
      readSession: () =>
        expectBody((id) =>
          api.GET("/v1/session", { headers: correlationHeader(id) }),
        ),
      endSession: async () => {
        await expectData((id) =>
          api.DELETE("/v1/session", {
            params: { header: mutationHeaders() },
            headers: correlationHeader(id),
          }),
        );
      },
      publish: setState,
      setCsrfToken,
    }),
  );
  const { reload, refresh, adopt, signOut } = owner;

  useEffect(() => {
    void reload();
  }, [reload]);

  // The desktop app's window signs in and sets up GitHub on the web, so it
  // reads the session again, with the GitHub connection it carries, whenever
  // the window gets focus back.
  useEffect(() => onShellFocus(() => void refresh()), [refresh]);

  const value = useMemo(
    () => ({ state, reload, adopt, signOut }),
    [state, reload, adopt, signOut],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** The session state and the commands that change it. */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("[app/session] useSession used outside SessionProvider");
  }
  return value;
}
