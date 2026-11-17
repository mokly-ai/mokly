import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiError } from "../api/errors";
import type { Build } from "../api/types";
import { getBuild, listBuildLog } from "../data/builds";
import { followBuild } from "./build-follow";
import type { BuildFollower } from "./build-follow";
import type { LogView } from "./build-log";

/**
 * How often the card reads a build that is still working, and its log. Three
 * seconds keeps live output live without a request a second per open tab, and
 * a hidden tab reads nothing at all.
 */
export const buildPollIntervalMs = 3_000;

/** What the card knows about the build it shows. */
export type BuildWatch =
  | { status: "idle" }
  | { status: "loading" }
  /** The first read answered `not-found`: unknown, elsewhere or not visible. */
  | { status: "missing"; error: ApiError }
  /** The first read failed for another reason; reading again may work. */
  | { status: "error"; error: ApiError }
  | { status: "ready"; build: Build; log: LogView };

function visible(): boolean {
  return (
    typeof document !== "undefined" && document.visibilityState === "visible"
  );
}

/**
 * Read one build and follow it while it works, as `followBuild` does: every
 * three seconds while the build is queued or running, or its log is not
 * complete, and the tab is visible, and at once when a hidden tab becomes
 * visible. A write's answer is shown through `apply`, in the same order as the
 * reads.
 */
export function useBuildWatch(
  projectId: string,
  buildId: string | undefined,
): {
  watch: BuildWatch;
  /** Repeat a first read that failed. */
  retry: () => void;
  /** Show a build a write answered with, such as a cancellation. */
  apply: (build: Build) => void;
} {
  const [watch, setWatch] = useState<BuildWatch>(
    buildId === undefined ? { status: "idle" } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const follower = useRef<BuildFollower | undefined>(undefined);

  useEffect(() => {
    if (buildId === undefined) {
      setWatch({ status: "idle" });
      return;
    }
    setWatch({ status: "loading" });
    const followed = followBuild({
      projectId,
      buildId,
      reads: { getBuild, listBuildLog },
      show: setWatch,
      visible,
    });
    follower.current = followed;
    const poll = () => void followed.poll();
    const timer = setInterval(poll, buildPollIntervalMs);
    document.addEventListener("visibilitychange", poll);
    return () => {
      followed.stop();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      if (follower.current === followed) follower.current = undefined;
    };
  }, [projectId, buildId, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const apply = useCallback(
    (build: Build) => follower.current?.apply(build),
    [],
  );
  return { watch, retry, apply };
}
