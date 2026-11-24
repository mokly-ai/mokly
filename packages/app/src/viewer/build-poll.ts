import type { LiveState, LiveSubscription } from "../data/live-client";

import type { BuildFollower } from "./build-follow";

interface BuildPollingInput {
  buildId: string;
  follower: Pick<BuildFollower, "firstRead" | "poll">;
  visible: () => boolean;
  every: (poll: () => void, intervalMs: number) => () => void;
  onVisibilityChange: (wake: () => void) => () => void;
}

interface BuildPolling {
  subscription: LiveSubscription;
  stop: () => void;
}

const pollIntervalMs: Record<LiveState, number> = { down: 3_000, up: 30_000 };

/** Wake the existing follower from the timer, tab visibility or live notices. */
export function watchBuildPolls(input: BuildPollingInput): BuildPolling {
  let stopped = false;
  let reading = true;
  let catchUp = false;
  let state: LiveState = "down";

  function settled() {
    reading = false;
    if (catchUp) {
      catchUp = false;
      poll();
    }
  }

  function poll() {
    if (stopped || reading || !input.visible()) return;
    reading = true;
    void input.follower.poll().then(settled, settled);
  }

  function wake() {
    if (stopped || !input.visible()) return;
    if (reading) catchUp = true;
    else poll();
  }

  let cancelTimer = input.every(poll, pollIntervalMs.down);
  const cancelVisibility = input.onVisibilityChange(wake);
  void input.follower.firstRead.then(settled, settled);

  return {
    subscription: {
      kinds: ["build", "build-log"],
      onNotice: (notice) => {
        if (notice.id === input.buildId) wake();
      },
      onResync: wake,
      onState: (next) => {
        if (stopped || state === next) return;
        state = next;
        cancelTimer();
        cancelTimer = input.every(poll, pollIntervalMs[state]);
      },
    },
    stop() {
      stopped = true;
      cancelTimer();
      cancelVisibility();
    },
  };
}
