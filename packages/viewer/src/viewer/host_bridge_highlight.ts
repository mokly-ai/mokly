/** Highlight activation over the shared inspection controller. */

import type { MutableRefObject } from "react";
import { useCallback } from "react";
import { flushSync } from "react-dom";

import type { ShellInspectionController } from "../shell/frame_inspection_controller.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../shell/frame_registry.js";

import type { viewerFailures } from "./failures.js";
import { viewerInstanceSessions } from "./host_bridge_evidence.js";
import type { ViewerInspectionGeometryOwnership } from "./inspection_geometry_ownership.js";
import type { ViewerInspectionPresentation } from "./inspection_layer.js";
import { ObsoleteInspection } from "./inspection_work.js";
import type { MoklyViewerHandle, PickEnd } from "./types.js";

interface HighlightInput {
  clearInspection(reason?: PickEnd): void;
  geometry: ViewerInspectionGeometryOwnership;
  inspection: ShellInspectionController | undefined;
  operation: MutableRefObject<number>;
  pendingOperation: MutableRefObject<number>;
  pendingSessions: MutableRefObject<ReadonlySet<ShellFrameSession> | undefined>;
  publishPresentation(
    presentation: ViewerInspectionPresentation | undefined,
  ): void;
  registry: ShellFrameRegistry | undefined;
  report: ReturnType<typeof viewerFailures>;
}

/** Keep one highlight request, its geometry and its error ownership together. */
export function useHostBridgeHighlight({
  clearInspection,
  geometry,
  inspection,
  operation,
  pendingOperation,
  pendingSessions,
  publishPresentation,
  registry,
  report,
}: HighlightInput): MoklyViewerHandle["highlightInstances"] {
  return useCallback(
    async (
      instances: Parameters<MoklyViewerHandle["highlightInstances"]>[0],
    ) => {
      if (!inspection) throw new Error("The viewer is not ready.");
      const request = ++operation.current;
      pendingOperation.current = request;
      const pending = new Set(viewerInstanceSessions(inspection, instances));
      pendingSessions.current = pending;
      const previousClaim = inspection.getSnapshot().active;
      try {
        const activation = await inspection.highlightInstances(instances);
        if (operation.current !== request) throw new ObsoleteInspection();
        if (activation) geometry.begin(activation.sessions);
        else geometry.clear();
        flushSync(() =>
          publishPresentation(
            instances.length
              ? {
                  kind: "instances",
                  instances: instances.map((instance) => ({ ...instance })),
                }
              : undefined,
          ),
        );
        if (activation)
          await inspection.run(
            activation.claim,
            () =>
              registry?.geometry.refresh(activation.sessions) ??
              Promise.resolve(),
          );
        if (operation.current !== request) throw new ObsoleteInspection();
      } catch (error) {
        if (
          operation.current === request &&
          (!previousClaim || !inspection.current(previousClaim))
        )
          clearInspection();
        throw report(error, "frame");
      } finally {
        if (pendingOperation.current === request) pendingOperation.current = 0;
        if (pendingSessions.current === pending)
          pendingSessions.current = undefined;
      }
    },
    [
      clearInspection,
      geometry,
      inspection,
      publishPresentation,
      registry,
      report,
    ],
  );
}
