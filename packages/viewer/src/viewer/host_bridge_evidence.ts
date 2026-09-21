/** Retained-frame evidence restoration for public viewer inspection. */

import { useCallback } from "react";
import type { MutableRefObject } from "react";

import { FrameError } from "../client/frame_error.js";
import type { ShellInspectionController } from "../shell/frame_inspection_controller.js";
import { matchesFrameInstance } from "../shell/frame_instances.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../shell/frame_registry.js";

import type { ViewerInspectionGeometryOwnership } from "./inspection_geometry_ownership.js";
import type { ViewerInspectionPresentation } from "./inspection_layer.js";
import { ObsoleteInspection } from "./inspection_work.js";
import type { Picking } from "./picking.js";
import type { InstanceRef, PickEnd } from "./types.js";

interface EvidenceRestorationHookInput {
  active: MutableRefObject<boolean>;
  clearInspection(reason?: PickEnd): void;
  geometry: ViewerInspectionGeometryOwnership;
  inspection: ShellInspectionController | undefined;
  operation: MutableRefObject<number>;
  pendingOperation: MutableRefObject<number>;
  pendingSessions: MutableRefObject<ReadonlySet<ShellFrameSession> | undefined>;
  picking: Picking;
  pickSessions: MutableRefObject<ReadonlySet<ShellFrameSession> | undefined>;
  presentation: MutableRefObject<ViewerInspectionPresentation | undefined>;
  registry: ShellFrameRegistry | undefined;
}

interface EvidenceRestorationInput {
  current(): boolean;
  geometry: ViewerInspectionGeometryOwnership;
  inspection: ShellInspectionController;
  presentation: ViewerInspectionPresentation;
  registry: ShellFrameRegistry;
}

/** Coordinate successive evidence revisions with public operation ownership. */
export function useViewerEvidenceRestoration({
  active,
  clearInspection,
  geometry,
  inspection,
  operation,
  pendingOperation,
  pendingSessions,
  picking,
  pickSessions,
  presentation,
  registry,
}: EvidenceRestorationHookInput): (
  sessions: readonly ShellFrameSession[],
) => void {
  return useCallback(
    (changedSessions: readonly ShellFrameSession[]) => {
      if (picking.activating || pendingOperation.current !== 0) {
        if (
          changedSessions.some((session) =>
            pendingSessions.current?.has(session),
          )
        )
          clearInspection({ reason: "evidence" });
        return;
      }
      if (!changedSessions.some((session) => geometry.owns(session))) return;
      const currentPresentation = presentation.current;
      if (!currentPresentation || !inspection || !registry) return;
      const request = ++operation.current;
      const current = () =>
        active.current &&
        operation.current === request &&
        presentation.current === currentPresentation;
      void restoreViewerEvidence({
        current,
        geometry,
        inspection,
        presentation: currentPresentation,
        registry,
      })
        .then(() => {
          if (current() && currentPresentation.kind === "pick")
            pickSessions.current = new Set(inspection.sessions());
        })
        .catch(() => {
          if (current())
            clearInspection(
              currentPresentation.kind === "pick"
                ? { reason: "evidence" }
                : undefined,
            );
        });
    },
    [
      active,
      clearInspection,
      geometry,
      inspection,
      operation,
      pendingOperation,
      pendingSessions,
      picking,
      pickSessions,
      presentation,
      registry,
    ],
  );
}

/** Identify mounted sessions addressed by a pending exact highlight request. */
export function viewerInstanceSessions(
  inspection: ShellInspectionController,
  instances: readonly InstanceRef[],
): readonly ShellFrameSession[] {
  return inspection
    .visibleSessions()
    .filter((session) =>
      instances.some((instance) => matchesFrameInstance(session, instance)),
    );
}

/** Reapply masks and geometry after retained sessions adopt newer evidence. */
export async function restoreViewerEvidence({
  current,
  geometry,
  inspection,
  presentation,
  registry,
}: EvidenceRestorationInput): Promise<readonly ShellFrameSession[]> {
  checkCurrent(current);
  if (presentation.kind === "pick") {
    inspection.cancelPick();
    const sessions = inspection.visibleSessions();
    await inspection.startPick(sessions);
    checkCurrent(current);
    const claim = inspection.getSnapshot().active;
    if (!claim || claim.kind !== "pick") throw new FrameError("unavailable");
    geometry.begin(sessions);
    await inspection.run(claim, () => registry.geometry.refresh(sessions));
    checkCurrent(current);
    return sessions;
  }

  const activation = await inspection.highlightInstances(
    presentation.instances,
  );
  checkCurrent(current);
  if (!activation) throw new FrameError("missing-instance");
  geometry.begin(activation.sessions);
  await inspection.run(activation.claim, () =>
    registry.geometry.refresh(activation.sessions),
  );
  checkCurrent(current);
  return activation.sessions;
}

function checkCurrent(current: () => boolean): void {
  if (!current()) throw new ObsoleteInspection();
}
