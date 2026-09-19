/** Exact instance matching over React-owned frame sessions. */

import { FrameError } from "../client/frame_error.js";
import { frameUsage } from "../client/frame_usage.js";
import type { GeneratedComponentView } from "../components/views.js";
import type { InstanceRef } from "../viewer/types.js";

import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "./frame_registry.js";
import type { WorkspaceData } from "./workspace_data.js";

/** Whether one session's complete identity matches a public instance reference. */
export function matchesFrameInstance(
  session: ShellFrameSession,
  instance: InstanceRef,
): boolean {
  const identity = session.identity;
  return (
    identity.entryId === instance.screenId &&
    identity.variantId === instance.variantId &&
    identity.stepIndex === instance.stepIndex &&
    identity.viewport === instance.viewport &&
    identity.colorScheme === instance.colorScheme
  );
}

/** Whether authenticated current usage contains an instance key. */
export function frameHasInstance(
  session: ShellFrameSession,
  key: string,
): boolean {
  return (
    validFrameUsage(session) &&
    session.usage.status === "ready" &&
    session.usage.instances.some((instance) => instance.key === key)
  );
}

/** List inspectable instances owned directly by one rendered entry. */
export function frameEntryKeys(session: ShellFrameSession): readonly string[] {
  if (!validFrameUsage(session) || session.usage.status !== "ready") return [];
  return session.usage.instances
    .filter((instance) => instance.owner.kind === "entry")
    .map((instance) => instance.key);
}

/** Resolve every exact reference before an inspection presentation mutates. */
export function matchFrameInstances(
  sessions: readonly ShellFrameSession[],
  instances: readonly InstanceRef[],
): readonly { session: ShellFrameSession; key: string }[] {
  return instances.map((instance) => {
    const session = sessions.find(
      (candidate) =>
        matchesFrameInstance(candidate, instance) &&
        frameHasInstance(candidate, instance.key),
    );
    if (!session) throw new FrameError("missing-instance");
    return { session, key: instance.key };
  });
}

/** Group a validated request into the keys presented by each frame. */
export function frameTargetKeys(
  targets: readonly { session: ShellFrameSession; key: string }[],
): ReadonlyMap<ShellFrameSession, Set<string>> {
  const keys = new Map<ShellFrameSession, Set<string>>();
  for (const target of targets) {
    const current = keys.get(target.session) ?? new Set<string>();
    current.add(target.key);
    keys.set(target.session, current);
  }
  return keys;
}

/** Convert a matched session key into the complete public reference. */
export function frameInstanceRef(
  session: ShellFrameSession,
  key: string,
): InstanceRef | undefined {
  const identity = session.identity;
  if (
    !identity.viewport ||
    !identity.colorScheme ||
    !frameHasInstance(session, key)
  )
    return;
  return {
    screenId: identity.entryId,
    viewport: identity.viewport,
    colorScheme: identity.colorScheme,
    key,
    ...(identity.variantId ? { variantId: identity.variantId } : {}),
    ...(identity.stepIndex === undefined
      ? {}
      : { stepIndex: identity.stepIndex }),
  };
}

/** Match the exact current workspace view, including route and effective axes. */
export function matchesWorkspaceFrame(
  session: ShellFrameSession,
  data: WorkspaceData,
  view: GeneratedComponentView,
): boolean {
  const identity = session.identity;
  return (
    identity.entryId === data.entry.id &&
    identity.route === data.entry.route &&
    identity.stepIndex === undefined &&
    identity.variantId === view.variantId &&
    identity.viewport === view.viewport &&
    identity.colorScheme === view.colorScheme
  );
}

/** Select one newest mounted session for every visible workspace view. */
export function workspaceFrameSessions(
  sessions: readonly ShellFrameSession[],
  data: WorkspaceData,
  views: readonly GeneratedComponentView[],
): readonly ShellFrameSession[] {
  return views.flatMap((view) => {
    const candidates = sessions.filter((session) =>
      matchesWorkspaceFrame(session, data, view),
    );
    const session = candidates.sort(
      (left, right) => right.generation - left.generation,
    )[0];
    return session ? [session] : [];
  });
}

/** Validate the bounded usage contract before any inspection operation. */
export function validFrameUsage(session: ShellFrameSession): boolean {
  if (session.usage.status !== "ready") return false;
  try {
    return !frameUsage(session.usage).error;
  } catch {
    return false;
  }
}

/** Capture the session revision that an asynchronous operation is allowed to use. */
export interface ShellFrameCapture {
  generation: number;
  session: ShellFrameSession;
  usageRevision: number;
}

export function captureFrame(session: ShellFrameSession): ShellFrameCapture {
  return {
    generation: session.generation,
    session,
    usageRevision: session.usageRevision,
  };
}

/** Reject late work after evidence adoption, replacement, or disposal. */
export function currentFrameCapture(
  registry: ShellFrameRegistry,
  capture: ShellFrameCapture,
): boolean {
  const { session } = capture;
  return (
    !session.controller.signal.aborted &&
    session.generation === capture.generation &&
    session.usageRevision === capture.usageRevision &&
    registry.values().includes(session)
  );
}
