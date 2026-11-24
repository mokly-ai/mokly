import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiError } from "../api/errors";
import type { Build } from "../api/types";
import { getBuild, listBuildLog } from "../data/builds";
import { liveClient } from "../data/live-client";
import type { LiveSubscription } from "../data/live-client";

import { followBuild } from "./build-follow";
import type { BuildFollower } from "./build-follow";
import type { LogView } from "./build-log";
import { watchBuildPolls } from "./build-poll";

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
 * Follow one build through its live notices and the visibility-aware poll.
 * Apply a write's answer in the same order as the reads.
 */
export function useBuildWatch(
  projectId: string,
  buildId: string | undefined,
  member: boolean,
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
  const follower = useRef<
    | (Pick<BuildFollower, "apply"> & { subscription: LiveSubscription })
    | undefined
  >(undefined);

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
    const polling = watchBuildPolls({
      buildId,
      follower: followed,
      visible,
      every: (poll, interval) => {
        const timer = setInterval(poll, interval);
        return () => clearInterval(timer);
      },
      onVisibilityChange: (wake) => {
        document.addEventListener("visibilitychange", wake);
        return () => document.removeEventListener("visibilitychange", wake);
      },
    });
    const current = {
      apply: followed.apply,
      subscription: polling.subscription,
    };
    follower.current = current;
    return () => {
      polling.stop();
      followed.stop();
      if (follower.current === current) follower.current = undefined;
    };
  }, [projectId, buildId, attempt]);

  useEffect(() => {
    const subscription = follower.current?.subscription;
    if (!member || !subscription) return;
    const leave = liveClient.subscribe(projectId, subscription);
    return () => {
      leave();
      subscription.onState?.("down");
    };
  }, [member, projectId, buildId, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const apply = useCallback(
    (build: Build) => follower.current?.apply(build),
    [],
  );
  return { watch, retry, apply };
}
