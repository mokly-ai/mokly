/** Public pick activation over the shared shell inspection controller. */

import type { MutableRefObject, RefObject } from "react";
import { flushSync } from "react-dom";

import type { ShellInspectionController } from "../shell/frame_inspection_controller.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../shell/frame_registry.js";

import type { ViewerInspectionGeometryOwnership } from "./inspection_geometry_ownership.js";
import type { ViewerInspectionPresentation } from "./inspection_layer.js";

interface PublicPickActivationInput {
  current(): boolean;
  geometry: ViewerInspectionGeometryOwnership;
  inspection: ShellInspectionController | undefined;
  pendingSessions: MutableRefObject<ReadonlySet<ShellFrameSession> | undefined>;
  pickSessions: MutableRefObject<ReadonlySet<ShellFrameSession> | undefined>;
  publish(presentation: ViewerInspectionPresentation): void;
  registry: ShellFrameRegistry | undefined;
  root: RefObject<HTMLElement | null>;
}

/** Present pick masks and labels before resolving the public activation. */
export async function activateViewerPick({
  current,
  geometry,
  inspection,
  pendingSessions,
  pickSessions,
  publish,
  registry,
  root,
}: PublicPickActivationInput): Promise<void> {
  if (!inspection) throw new Error("The viewer is not ready.");
  const sessions = inspection.visibleSessions();
  const pending = new Set(sessions);
  pendingSessions.current = pending;
  pickSessions.current = new Set(inspection.sessions());
  try {
    await inspection.startPick(sessions);
    if (!current()) return;
    geometry.begin(sessions);
    flushSync(() => publish({ kind: "pick" }));
    const claim = inspection.getSnapshot().active;
    if (!claim || claim.kind !== "pick")
      throw new Error("The viewer is not ready.");
    await inspection.run(
      claim,
      () => registry?.geometry.refresh(sessions) ?? Promise.resolve(),
    );
    if (current()) root.current?.focus({ preventScroll: true });
  } finally {
    if (pendingSessions.current === pending)
      pendingSessions.current = undefined;
  }
}
