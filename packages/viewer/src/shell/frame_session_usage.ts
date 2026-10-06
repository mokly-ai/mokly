/** Usage adoption for one mounted frame session, including mount completion. */

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import type { CatalogueUsage } from "../catalogue/types.js";
import { FrameError } from "../client/frame_error.js";

import { adoptedFrameReadiness } from "./frame_readiness.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "./frame_registry.js";

/** Lifecycle status that a mounted frame reports to its React owner. */
export type ShellFrameStatus = "error" | "loading" | "ready" | "unavailable";

/** Frame session with the private state its mount and usage updates share. */
export interface ActiveSession extends ShellFrameSession {
  appliedUsageRevision: number;
  initializing: boolean;
  rejectReady(error: unknown): void;
  unsubscribe?: () => void;
  updates: Promise<void>;
  replacing?: boolean;
}

/** Adopt changed usage on a mounted session without replacing its document. */
export async function adoptUsage(
  registry: ShellFrameRegistry,
  session: ActiveSession,
  usage: CatalogueUsage<CurrentPath | BranchPointPath>,
  replace: () => void,
  setStatus: (status: ShellFrameStatus) => void,
): Promise<void> {
  const revision = ++session.usageRevision;
  session.usage = usage;
  const mounted = session.mounted;
  if (!mounted || session.initializing) {
    registry.changed();
    return;
  }
  if (!mounted.updateUsage) {
    registry.changed();
    if (!session.replacing) {
      session.replacing = true;
      replace();
    }
    return;
  }
  const update = session.updates
    .catch(() => undefined)
    .then(async () => {
      if (
        session.controller.signal.aborted ||
        session.usageRevision !== revision
      )
        return;
      await mounted.updateUsage!(usage);
      session.appliedUsageRevision = Math.max(
        session.appliedUsageRevision,
        revision,
      );
    });
  session.updates = update;
  const readiness = adoptedFrameReadiness(
    session.controller.signal,
    update.then(() => mounted),
  );
  session.rejectReady(new FrameError("disposed"));
  session.ready = readiness.promise;
  session.rejectReady = readiness.reject;
  void session.ready.catch(() => undefined);
  registry.changed();
  await update.then(
    () => {
      if (
        !session.controller.signal.aborted &&
        session.usageRevision === revision
      ) {
        setStatus("ready");
        session.status = "ready";
        registry.changed();
      }
    },
    () => {
      if (
        !session.controller.signal.aborted &&
        session.usageRevision === revision
      ) {
        setStatus("error");
        session.status = "error";
        registry.changed();
      }
    },
  );
}

/**
 * Apply every usage revision adopted while the adapter mounted, then run
 * `finish` in the same task as the final revision check. An adoption before
 * that check joins this loop; a later one sees an initialized session and
 * takes the mounted-update path, so no adopted revision is skipped.
 */
export async function finishMountedUsage(
  registry: ShellFrameRegistry,
  session: ActiveSession,
  replace: () => void,
  finish: () => void,
): Promise<void> {
  const mounted = session.mounted;
  if (!mounted) return;
  while (
    !session.controller.signal.aborted &&
    session.appliedUsageRevision < session.usageRevision
  ) {
    if (!mounted.updateUsage) {
      if (!session.replacing) {
        session.replacing = true;
        replace();
      }
      return;
    }
    const revision = session.usageRevision;
    try {
      await mounted.updateUsage(session.usage);
      session.appliedUsageRevision = revision;
      registry.changed();
    } catch (error) {
      if (revision === session.usageRevision) throw error;
    }
  }
  if (!session.controller.signal.aborted) finish();
}
