import type { ReactNode } from "react";

import type {
  DesktopGrantRequest,
  DesktopGrantResult,
  Session,
} from "../../../api/types";
import type { SessionState } from "../../../session/context";

/**
 * The stand-ins of `connect-desktop-screen.test.ts`, which resolves each
 * import of `session/context.tsx` and `data/auth.ts` to this module. Nothing
 * here is refused until a test says so, and only the request the test names:
 *
 * - the reader is signed in as `signedIn`, and signing out runs
 *   `boundary.signOut`;
 * - a desktop grant request runs `boundary.issueDesktopGrant`;
 * - every other export of `data/auth.ts` is the real one.
 */
export * from "../../../data/auth";

/** The session the screen reads. */
export const signedIn: Session = {
  user: {
    id: "01994f10-0000-7000-8000-000000000011",
    name: "Person",
    email: "person@example.com",
    githubConnected: true,
  },
  csrfToken: "csrf",
  workspaceIds: ["01994f10-0000-7000-8000-000000000044"],
};

/** What the two requests of the screen answer, which a test replaces. */
export const boundary = {
  signOut: (): Promise<void> => Promise.resolve(),
  issueDesktopGrant: (
    input: DesktopGrantRequest,
  ): Promise<DesktopGrantResult> =>
    Promise.reject(new Error(`no grant for ${input.challenge}`)),
};

/** Put both requests back at rest before the next test. */
export function settle(): void {
  boundary.signOut = () => Promise.resolve();
  boundary.issueDesktopGrant = (input) =>
    Promise.reject(new Error(`no grant for ${input.challenge}`));
}

/** The session provider, which holds nothing here. */
export function SessionProvider({ children }: { children: ReactNode }) {
  return children;
}

/** The session state, signed in from the first render. */
export function useSession() {
  const state: SessionState = { status: "signed-in", session: signedIn };
  const settled = async () => undefined;
  return {
    state,
    reload: settled,
    adopt: () => undefined,
    signOut: () => boundary.signOut(),
  };
}

/** The grant request, answered by `boundary`. */
export function issueDesktopGrant(
  input: DesktopGrantRequest,
): Promise<DesktopGrantResult> {
  return boundary.issueDesktopGrant(input);
}
