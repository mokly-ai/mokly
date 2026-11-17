import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  api,
  correlationHeader,
  expectBody,
  expectData,
  mutationHeaders,
  setCsrfToken,
} from "../api/client";
import { asApiError } from "../api/errors";
import type { ApiError } from "../api/errors";
import type { Session } from "../api/types";

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
 * Every write carries a generation. The magic-link exchange adopts a session
 * while the start-up read is still in flight, and that read answers for the
 * request before it: without the generation its stale "no session" would land
 * last and send a reader who just signed in back to the entry screen.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const generation = useRef(0);

  const apply = useCallback((mine: number, next: SessionState) => {
    if (generation.current !== mine) return;
    setState(next);
  }, []);

  const adopt = useCallback((session: Session) => {
    generation.current += 1;
    setCsrfToken(session.csrfToken);
    setState({ status: "signed-in", session });
  }, []);

  const reload = useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    try {
      const session = await expectBody((id) =>
        api.GET("/v1/session", { headers: correlationHeader(id) }),
      );
      if (generation.current !== mine) return;
      setCsrfToken(session.csrfToken);
      apply(mine, { status: "signed-in", session });
    } catch (caught) {
      const error = asApiError(caught);
      if (error?.signedOut) {
        if (generation.current !== mine) return;
        setCsrfToken("");
        apply(mine, { status: "signed-out" });
        return;
      }
      apply(
        mine,
        error ? { status: "error", error } : { status: "signed-out" as const },
      );
    }
  }, [apply]);

  const signOut = useCallback(async () => {
    try {
      await expectData((id) =>
        api.DELETE("/v1/session", {
          params: { header: mutationHeaders() },
          headers: correlationHeader(id),
        }),
      );
    } catch (caught) {
      if (!asApiError(caught)?.signedOut) throw caught;
    }
    generation.current += 1;
    setCsrfToken("");
    setState({ status: "signed-out" });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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
