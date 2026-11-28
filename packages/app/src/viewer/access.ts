import { useCallback, useEffect, useMemo, useState } from "react";

import { createPublicationAccess } from "./access-exchange";
import type { FrameAccess, PrivateAccessState } from "./access-exchange";

/** Where the reader stands with the publication host's own credential. */
export type AccessState =
  { status: "open" } | { status: "granting" } | PrivateAccessState;

/** What the viewer needs before it can point the host at a catalogue. */
export interface CatalogueAccess {
  state: AccessState;
  retry: () => void;
  frame?: FrameAccess;
}

export interface AccessRequest {
  projectId: string;
  publicationId: string;
  origin?: string;
  /** A public catalogue needs no exchange. */
  required: boolean;
  /** Only a ready publication can open. */
  enabled: boolean;
}

/** The identity of one attempt, even on a return to the same publication. */
type AccessAttempt = AccessRequest & { attempt: number };

export interface ScopedAccess {
  key: AccessAttempt;
  state: AccessState;
}

const granting: AccessState = { status: "granting" };

/** Readiness for the source being rendered. */
export function currentAccessState(
  currentKey: AccessAttempt,
  settled: ScopedAccess,
): AccessState {
  return settled.key === currentKey ? settled.state : granting;
}

export function useCatalogueAccess(input: AccessRequest): CatalogueAccess {
  const [attempt, setAttempt] = useState(0);
  const { projectId, publicationId, origin, required, enabled } = input;
  const key = useMemo(
    () => ({ projectId, publicationId, origin, required, enabled, attempt }),
    [projectId, publicationId, origin, required, enabled, attempt],
  );
  const [scoped, setScoped] = useState<ScopedAccess>({ key, state: granting });

  useEffect(() => {
    if (!key.enabled) return;
    if (!key.required) {
      setScoped({ key, state: { status: "open" } });
      return;
    }
    if (key.origin === undefined) return;
    let live = true;
    const publication = createPublicationAccess({
      projectId: key.projectId,
      publicationId: key.publicationId,
      origin: key.origin,
    });
    void publication.confirm().then((state) => {
      if (live) setScoped({ key, state });
    });
    return () => {
      live = false;
    };
  }, [key]);

  const state = currentAccessState(key, scoped);
  const frame = useMemo<FrameAccess | undefined>(() => {
    if (state.status !== "granted") return undefined;
    return {
      access: state.publication.access,
      onAccessFailure: () => {
        setScoped((current) =>
          current.key === key && current.state === state
            ? { key, state: { status: "blocked" } }
            : current,
        );
      },
    };
  }, [key, state]);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry, frame };
}
