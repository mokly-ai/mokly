import { useEffect, useState } from "react";

import { readReferenceRow } from "../data/publications";
import type { PublicationRef } from "../data/publications";

/**
 * How often the viewer asks whether this reference has published again. One
 * minute is often enough that a reviewer watching a branch sees the offer
 * without refreshing, and rare enough that an open tab is not a load on the
 * API. The tab is asked only while it is visible, so a backgrounded reader
 * costs nothing at all.
 */
export const latestPollIntervalMs = 60_000;

function visible(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "visible";
}

/** Read the latest offer without changing the publication the reader opened. */
export async function readLatestPublication(
  projectId: string,
  ref: PublicationRef,
  currentId: string,
): Promise<string | undefined> {
  const row = await readReferenceRow(projectId, ref);
  const target = row?.latestPublicationId;
  return target != null && target !== currentId ? target : undefined;
}

/**
 * The newest ready publication on the reference the reader is inside, when it
 * is not the one they are reading. The reader is never moved: this only decides
 * whether the chrome offers the way there, because taking a reader off the
 * publication they are studying loses their place in it.
 *
 * The reference is passed as the two values that identify it rather than as an
 * object, so a caller rebuilding that object on every render cannot restart the
 * poll on every render.
 */
export function useLatestPublication(input: {
  projectId: string;
  currentId?: string;
  branch?: string;
  pullRequest?: number;
  enabled: boolean;
}): string | undefined {
  const [latest, setLatest] = useState<string | undefined>(undefined);
  const { projectId, currentId, branch, pullRequest, enabled } = input;

  useEffect(() => {
    setLatest(undefined);
  }, [currentId, branch, pullRequest]);

  useEffect(() => {
    const ref: PublicationRef | undefined =
      pullRequest !== undefined
        ? { kind: "pull-request", number: pullRequest }
        : branch !== undefined
          ? { kind: "branch", name: branch }
          : undefined;
    if (!enabled || currentId === undefined || ref === undefined) return;
    let live = true;
    const ask = () => {
      if (!visible()) return;
      readLatestPublication(projectId, ref, currentId)
        .then((publicationId) => {
          if (live) setLatest(publicationId);
        })
        .catch(() => undefined);
    };
    const timer = setInterval(ask, latestPollIntervalMs);
    const wake = () => ask();
    document.addEventListener("visibilitychange", wake);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [projectId, currentId, branch, pullRequest, enabled]);

  return latest;
}
