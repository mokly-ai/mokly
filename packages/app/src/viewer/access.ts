import { useCallback, useEffect, useState } from "react";

import { asApiError, unexpectedError } from "../api/errors";
import type { ApiError } from "../api/errors";
import { issueCatalogueGrant } from "../data/publications";

/** Where the reader stands with the publication host's own credential. */
export type AccessState =
  | { status: "open" }
  | { status: "granting" }
  | { status: "granted" }
  | { status: "refused"; error: ApiError }
  | { status: "blocked" };

/** What the viewer needs before it can point the host at a catalogue. */
export interface CatalogueAccess {
  state: AccessState;
  retry: () => void;
}

/** What one publication's access exchange is asked for. */
export interface AccessRequest {
  projectId: string;
  publicationId: string;
  /** Public catalogues are readable without a credential, so none is asked for. */
  required: boolean;
  /** Nothing is exchanged until the route has a ready publication to open. */
  enabled: boolean;
}

/** One access answer and the exact source attempt it belongs to. */
export interface ScopedAccess {
  key: string;
  state: AccessState;
}

const granting: AccessState = { status: "granting" };

/** Readiness for the source being rendered, never for an earlier source. */
export function currentAccessState(
  currentKey: string,
  settled: ScopedAccess,
): AccessState {
  return settled.key === currentKey ? settled.state : granting;
}

/**
 * Exchange one new grant at the publication's own host for its cookie, and
 * answer that host's origin, or nothing when the host refused the grant.
 *
 * The app session never leaves the app origin. The API issues a one-use grant,
 * and the publication's own host exchanges it for a host-only cookie.
 */
async function exchangeGrant(
  projectId: string,
  publicationId: string,
): Promise<string | undefined> {
  const grant = await issueCatalogueGrant(projectId, publicationId);
  const accepted = await fetch(grant.exchangeUrl, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grant: grant.grant }),
  });
  return accepted.ok ? new URL(grant.exchangeUrl).origin : undefined;
}

/**
 * Prove the reader may open this publication to the host that serves it.
 *
 * Only after the exchange is the catalogue reachable. The exchange is
 * confirmed by asking that host for the catalogue once: a browser that refuses
 * the cookie answers the same way an expired one does, and telling those apart
 * is the difference between offering a retry that will work and one that
 * cannot.
 */
async function exchange(
  projectId: string,
  publicationId: string,
): Promise<AccessState> {
  const origin = await exchangeGrant(projectId, publicationId);
  if (origin === undefined) {
    return { status: "refused", error: unexpectedError() };
  }
  const reachable = await fetch(origin + "/", { credentials: "include" });
  return reachable.ok ? { status: "granted" } : { status: "blocked" };
}

/**
 * Run the exchange again while the catalogue stays mounted, for a private
 * detail read that answered 401. It never changes the access state, whose
 * retry would remount the viewer; a refusal fails only the read that asked.
 */
export async function renewCatalogueAccess(
  projectId: string,
  publicationId: string,
): Promise<void> {
  if ((await exchangeGrant(projectId, publicationId)) === undefined) {
    throw unexpectedError();
  }
}

/**
 * The credential the stage needs before it mounts, and the way back when the
 * reader's has expired. A public catalogue needs none, so nothing is asked for
 * and the stage opens immediately.
 */
export function useCatalogueAccess(input: AccessRequest): CatalogueAccess {
  const [attempt, setAttempt] = useState(0);
  const { projectId, publicationId, required, enabled } = input;
  const key = [projectId, publicationId, required, enabled, attempt].join(":");
  const [scoped, setScoped] = useState<ScopedAccess>({
    key,
    state: granting,
  });

  useEffect(() => {
    if (!enabled) return;
    if (!required) {
      setScoped({ key, state: { status: "open" } });
      return;
    }
    let live = true;
    setScoped({ key, state: granting });
    exchange(projectId, publicationId)
      .then((next) => {
        if (live) setScoped({ key, state: next });
      })
      .catch((caught: unknown) => {
        if (!live) return;
        setScoped({
          key,
          state: {
            status: "refused",
            error: asApiError(caught) ?? unexpectedError(),
          },
        });
      });
    return () => {
      live = false;
    };
  }, [projectId, publicationId, required, enabled, attempt, key]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state: currentAccessState(key, scoped), retry };
}

/** Whether the stage may mount the catalogue this access was asked for. */
export function accessOpen(state: AccessState): boolean {
  return state.status === "open" || state.status === "granted";
}
