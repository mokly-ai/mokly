/** Identity comparison and disposal for one adapter-owned frame session. */

import type { RefObject } from "react";

import { FrameError } from "../client/frame_error.js";
import { cancelFrameMount } from "../client/frame_mount.js";

import { runFrameCleanup } from "./frame_cleanup.js";
import type {
  ShellFrameIdentity,
  ShellFrameRegistry,
  ShellFrameSession,
} from "./frame_registry.js";

/** Compare all axes that identify the rendered document. */
export function sameFrameIdentity(
  left: ShellFrameIdentity,
  right: ShellFrameIdentity,
): boolean {
  return (
    left.colorScheme === right.colorScheme &&
    left.entryId === right.entryId &&
    left.stepIndex === right.stepIndex &&
    left.variantId === right.variantId &&
    left.viewport === right.viewport
  );
}

interface DisposableSession extends ShellFrameSession {
  rejectReady(error: unknown): void;
  unsubscribe?: () => void;
}

/** Release only this session's ownership and run every cleanup. */
export function disposeSession<T extends DisposableSession>(
  registry: ShellFrameRegistry,
  session: T,
  active: RefObject<T | undefined>,
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
