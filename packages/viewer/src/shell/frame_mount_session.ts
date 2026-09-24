import type { RefObject } from "react";

import type { CatalogueUsage } from "../catalogue/types.js";
import { FrameError } from "../client/frame_error.js";
import { cancelFrameMount } from "../client/frame_mount.js";

import { runFrameCleanup } from "./frame_cleanup.js";
import type { ShellFrameStatus } from "./frame_mount_hook.js";
import { adoptedFrameReadiness } from "./frame_readiness.js";
import type {
  ShellFrameIdentity,
  ShellFrameRegistry,
  ShellFrameSession,
} from "./frame_registry.js";

export interface ActiveSession extends ShellFrameSession {
  appliedUsageRevision: number;
  initializing: boolean;
  rejectReady(error: unknown): void;
  unsubscribe?: () => void;
  updates: Promise<void>;
  replacing?: boolean;
}

/** Adopt new evidence without remounting a frame unless its adapter requires it. */
export async function adoptUsage(
  registry: ShellFrameRegistry,
  session: ActiveSession,
  usage: CatalogueUsage,
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

/** Wait for every usage revision arriving during mount before publishing readiness. */
export async function synchronizeMountedUsage(
  registry: ShellFrameRegistry,
  session: ActiveSession,
  replace: () => void,
): Promise<boolean> {
  const mounted = session.mounted;
  if (!mounted) return false;
  while (
    !session.controller.signal.aborted &&
    session.appliedUsageRevision < session.usageRevision
  ) {
    if (!mounted.updateUsage) {
      if (!session.replacing) {
        session.replacing = true;
        replace();
      }
      return false;
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
  return !session.controller.signal.aborted;
}

export function sameFrameIdentity(
  current: ShellFrameIdentity,
  next: ShellFrameIdentity,
): boolean {
  return (
    current.colorScheme === next.colorScheme &&
    current.entryId === next.entryId &&
    current.route === next.route &&
    current.stepIndex === next.stepIndex &&
    current.variantId === next.variantId &&
    current.viewport === next.viewport
  );
}

export function disposeSession(
  registry: ShellFrameRegistry,
  session: ActiveSession,
  active: RefObject<ActiveSession | undefined>,
): void {
  if (active.current === session) active.current = undefined;
  runFrameCleanup([
    () => session.rejectReady(new FrameError("disposed")),
    () => session.controller.abort(),
    () => session.unsubscribe?.(),
    () => session.mounted?.dispose(),
    () => cancelFrameMount(session.element),
    () => registry.remove(session),
  ]);
}
