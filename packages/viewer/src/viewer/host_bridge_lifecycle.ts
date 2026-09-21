/** React lifecycle ownership for the public viewer host bridge. */

import { useEffect, useLayoutEffect } from "react";
import type { MutableRefObject, RefObject } from "react";

import type { FrameEvent } from "../client/frame_adapter.js";
import type { ShellInspectionController } from "../shell/frame_inspection_controller.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../shell/frame_registry.js";

import { runCleanup } from "./cleanup.js";
import { deferHostBridgeFailure } from "./host_bridge_failure.js";
import type { Picking } from "./picking.js";
import type { PickEnd } from "./types.js";

interface HostBridgeLifecycleInput {
  active: MutableRefObject<boolean>;
  clearInspection(reason?: PickEnd): void;
  evidenceChanged(sessions: readonly ShellFrameSession[]): void;
  failureOwner: object;
  inspection: ShellInspectionController | undefined;
  navigationEnd: MutableRefObject<(() => void) | undefined>;
  picking: Picking;
  receive(session: ShellFrameSession, event: FrameEvent): void;
  registry: ShellFrameRegistry | undefined;
  replaced(): boolean;
  root: RefObject<HTMLElement | null>;
}

/** Own host subscriptions and drain them before forwarding cleanup failures. */
export function useHostBridgeLifecycle({
  active,
  clearInspection,
  evidenceChanged,
  failureOwner,
  inspection,
  navigationEnd,
  picking,
  receive,
  registry,
  replaced,
  root,
}: HostBridgeLifecycleInput): void {
  useLayoutEffect(() => {
    if (!registry) return;
    active.current = true;
    navigationEnd.current = () => clearInspection({ reason: "navigation" });
    const unsubscribe = registry.subscribeEvents(receive);
    let revisions = new Map(
      registry
        .values()
        .map((session) => [session, session.usageRevision] as const),
    );
    const unsubscribeRegistry = registry.subscribe(() => {
      const sessions = registry.values();
      const changedEvidence = sessions.filter(
        (session) =>
          revisions.has(session) &&
          revisions.get(session) !== session.usageRevision,
      );
      revisions = new Map(
        sessions.map((session) => [session, session.usageRevision] as const),
      );
      if (changedEvidence.length) evidenceChanged(changedEvidence);
    });
    return () => {
      try {
        runCleanup([
          () =>
            picking.end(replaced() ? { reason: "source-change" } : undefined),
          () => {
            active.current = false;
          },
          () => {
            navigationEnd.current = undefined;
          },
          unsubscribe,
          unsubscribeRegistry,
          () => inspection?.highlightInstances([]).catch(() => undefined),
        ]);
      } catch (error) {
        deferHostBridgeFailure(failureOwner, error);
      }
    };
  }, [
    active,
    clearInspection,
    evidenceChanged,
    failureOwner,
    inspection,
    navigationEnd,
    picking,
    receive,
    registry,
    replaced,
    root,
  ]);

  useEffect(() => {
    if (!registry) return;
    const shell = root.current;
    if (!shell) return;
    const comparison = () => {
      const mode = shell
        .querySelector('[data-diff-mode][aria-pressed="true"]')
        ?.getAttribute("data-diff-mode");
      if (mode && mode !== "current") clearInspection({ reason: "navigation" });
      void registry.geometry.refresh().catch(() => undefined);
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        (!picking.active && !picking.activating)
      )
        return;
      event.preventDefault();
      clearInspection({ reason: "escape" });
    };
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          ({ target }) =>
            target instanceof Element && target.matches("[data-diff-mode]"),
        )
      )
        comparison();
    });
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ["aria-pressed"],
      subtree: true,
    });
    shell.addEventListener("keydown", escape);
    shell.addEventListener("mokly:comparison", comparison);
    return () => {
      observer.disconnect();
      shell.removeEventListener("keydown", escape);
      shell.removeEventListener("mokly:comparison", comparison);
    };
  }, [clearInspection, picking, registry, root]);
}
