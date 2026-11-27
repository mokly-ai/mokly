import type { ReactNode } from "react";

import { ApiError } from "../api/errors";
import type { Session } from "../api/types";
import type { SessionState } from "../session/context";
import { useWrite as restingWrite } from "../settings/write";

/**
 * The stand-ins of `write-failure-places.test.ts`, which resolves each import
 * of `settings/write.ts`, `session/context.tsx` and `@firna/ui/modal` to this
 * module. A server render runs no press and no effect, so these put a screen
 * in Node where its writes have already been refused:
 *
 * - every write mounts refused with `refusal`, through the `failed` seed the
 *   real `useWrite` takes for a refusal met before its control mounted. The
 *   rest is the real module, so each control's label and the write-failure
 *   fragment around it are the product's;
 * - the reader is signed in as `signedIn`;
 * - a modal draws its content in place, as the page's portal would.
 */
export * from "../settings/write";

/** The refusal every write mounts with: Mokly was busy. */
export const refusal = new ApiError({
  code: "unavailable",
  reason: "unavailable",
  message: "The API is busy.",
  requestId: "req_write_failure_places",
  status: 503,
});

/** The real `useWrite`, refused from its first render. */
export const useWrite: typeof restingWrite = (done, sendable, failed) =>
  restingWrite(done, sendable, failed ?? refusal);

/** The session every screen reads. */
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

/** The session provider, which holds nothing here. */
export function SessionProvider({ children }: { children: ReactNode }) {
  return children;
}

/** The session state, signed in from the first render. */
export function useSession() {
  const state: SessionState = { status: "signed-in", session: signedIn };
  const settled = async () => undefined;
  return { state, reload: settled, adopt: () => undefined, signOut: settled };
}

/** The package modal frame, drawing its content in place. */
export function WebModalFrame({ children }: { children: ReactNode }) {
  return children;
}
