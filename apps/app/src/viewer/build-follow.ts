import { asApiError, unexpectedError } from "../api/errors";
import type { Build, BuildLog } from "../api/types";

import { emptyLog, receiveWindow, windowFull } from "./build-log";
import type { LogView } from "./build-log";
import { buildActive } from "./build-state";
import type { BuildWatch } from "./build-watch";

/**
 * How many windows one read follows at once while each comes back full. The
 * retained log is one MiB and a window holds up to 256 KiB, so this bound is
 * never what stops a read of retained output.
 */
const windowsPerRead = 8;

/** The reads one card makes of the build it follows. */
export interface BuildReads {
  getBuild: (projectId: string, buildId: string) => Promise<Build>;
  listBuildLog: (
    projectId: string,
    buildId: string,
    after: number,
  ) => Promise<BuildLog>;
}

/** One build a card follows, from its first read until it stops. */
export interface BuildFollower {
  /** The first read of the build and its log, settled. */
  firstRead: Promise<void>;
  /**
   * Read the build and its log after its last sequence again, unless a read
   * is already running, the tab is hidden, the first read found no build or
   * nothing more can change. Settles when that read does.
   */
  poll: () => Promise<void>;
  /** Show the build a write answered with, such as a cancellation. */
  apply: (build: Build) => void;
  /** Stop following: nothing read after this changes the card. */
  stop: () => void;
}

/** Whether nothing more can change: the build ended and its log is whole. */
function settled(build: Build | undefined, log: LogView): boolean {
  return build !== undefined && !buildActive(build.state) && log.complete;
}

/**
 * Whether one answer about a build may replace the build the card shows. A
 * finished build never returns to queued or running; `running` to `queued` is
 * an infrastructure retry and is shown.
 */
function moves(shown: Build | undefined, answer: Build): boolean {
  if (shown === undefined || shown.id !== answer.id) return true;
  return buildActive(shown.state) || !buildActive(answer.state);
}

/**
 * Follow one build. The first read decides what the card is; after it, each
 * poll reads the build and the log after its last sequence. A poll that fails
 * changes nothing on screen: only a read that succeeds moves the card.
 *
 * Writes and reads keep one order. The card applies a build read only if it
 * started after the last write answer the card applied, such as Cancel's, so
 * an older read that arrives later is dropped. Neither a read nor a write
 * answer moves a finished build back to queued or running. Both rules belong
 * to this one build: a build a request starts is followed afresh.
 */
export function followBuild(input: {
  projectId: string;
  buildId: string;
  reads: BuildReads;
  /** Show what the card knows now. */
  show: (watch: BuildWatch) => void;
  /** Whether the tab is visible: a hidden tab reads nothing. */
  visible: () => boolean;
}): BuildFollower {
  const { projectId, buildId, reads, show, visible } = input;
  let live = true;
  let busy = false;
  /** Counts read starts and applied write answers, in the order they happen. */
  let clock = 0;
  /** When the last write answer the card applied was applied. */
  let written = 0;
  let build: Build | undefined;
  let log: LogView = emptyLog;

  const showReady = () => {
    if (live && build) show({ status: "ready", build, log });
  };
  const readLog = async () => {
    for (let read = 0; read < windowsPerRead; read += 1) {
      const window = await reads.listBuildLog(projectId, buildId, log.after);
      if (!live) return;
      log = receiveWindow(log, window);
      showReady();
      if (!windowFull(window)) return;
    }
  };
  const readBuild = async () => {
    clock += 1;
    const started = clock;
    const answer = await reads.getBuild(projectId, buildId);
    if (!live || started < written || !moves(build, answer)) return;
    build = answer;
    showReady();
  };
  const exclusive = async (work: () => Promise<unknown>) => {
    if (busy || !live) return;
    busy = true;
    try {
      await work();
    } finally {
      busy = false;
    }
  };

  const firstRead = exclusive(async () => {
    try {
      await readBuild();
    } catch (caught) {
      if (!live) return;
      const error = asApiError(caught) ?? unexpectedError();
      show(
        error.reason === "not-found"
          ? { status: "missing", error }
          : { status: "error", error },
      );
      return;
    }
    await readLog().catch(() => undefined);
  });

  return {
    firstRead,
    poll: async () => {
      // Only a build the first read found is followed; a first read that
      // failed waits for the reader's own Try again.
      if (!build || !visible() || settled(build, log)) return;
      await exclusive(() => Promise.allSettled([readBuild(), readLog()]));
    },
    apply: (answer) => {
      if (!live || build?.id !== answer.id || !moves(build, answer)) return;
      clock += 1;
      written = clock;
      build = answer;
      showReady();
    },
    stop: () => {
      live = false;
    },
  };
}
