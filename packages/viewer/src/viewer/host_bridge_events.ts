/** Authenticated frame events routed through current public inspection ownership. */

import { useCallback } from "react";
import type { MutableRefObject } from "react";

import type { Box, FrameEvent } from "../client/frame_adapter.js";
import { FrameError } from "../client/frame_error.js";
import type { ShellInspectionController } from "../shell/frame_inspection_controller.js";
import {
  frameHasInstance,
  frameInstanceRef,
  validFrameUsage,
} from "../shell/frame_instances.js";
import type { ShellFrameSession } from "../shell/frame_registry.js";

import type { ViewerInspectionGeometryOwnership } from "./inspection_geometry_ownership.js";
import type { MoklyViewerProps, PickEnd } from "./types.js";

interface HostBridgeEventInput {
  callbacks: MutableRefObject<MoklyViewerProps>;
  clearInspection(reason?: PickEnd): void;
  geometry: ViewerInspectionGeometryOwnership;
  inspection: ShellInspectionController | undefined;
  picking: { readonly active: boolean };
  pickSessions: MutableRefObject<ReadonlySet<ShellFrameSession> | undefined>;
  report(error: unknown, code: "frame"): Error;
  selectedEntryId: string | null;
}

/** Route only events owned by the current public inspection generation. */
export function useHostBridgeEvents({
  callbacks,
  clearInspection,
  geometry,
  inspection,
  picking,
  pickSessions,
  report,
  selectedEntryId,
}: HostBridgeEventInput) {
  const receiveInstance = useCallback(
    (
      session: ShellFrameSession,
      key: string | null,
      boxes: readonly Box[],
      type: "click" | "hover",
    ) => {
      if (key !== null && !frameHasInstance(session, key)) {
        clearInspection({ reason: "error" });
        report(new FrameError("missing-instance"), "frame");
        return;
      }
      const instance = key === null ? null : frameInstanceRef(session, key);
      if (key !== null && !instance) {
        clearInspection({ reason: "error" });
        report(new FrameError("missing-instance"), "frame");
        return;
      }
      const detail = {
        instance: instance ?? null,
        boxes,
        frame: {
          entryId: selectedEntryId ?? session.identity.entryId,
          ...(session.identity.stepIndex === undefined
            ? {}
            : { stepIndex: session.identity.stepIndex }),
        },
      };
      if (type === "hover") callbacks.current.onInstanceHover?.(detail);
      else if (instance) {
        callbacks.current.onInstanceClick?.(detail);
        if (picking.active && pickSessions.current?.has(session))
          clearInspection({ reason: "selected", instance });
      }
    },
    [
      callbacks,
      clearInspection,
      picking,
      pickSessions,
      report,
      selectedEntryId,
    ],
  );

  const receive = useCallback(
    (session: ShellFrameSession, event: FrameEvent) => {
      const current = inspection?.sessions().includes(session) ?? false;
      const visible = inspection?.visibleSessions().includes(session) ?? false;
      const ownedPick = current && Boolean(pickSessions.current?.has(session));
      const ownedPresentation = current && geometry.owns(session);
      if (event.type === "error") {
        if (!ownedPick && !ownedPresentation) return;
        clearInspection({ reason: "error" });
        report(new FrameError(event.code), "frame");
        return;
      }
      if (event.type === "pick-end") {
        if (!ownedPick) return;
        clearInspection({ reason: "escape" });
        return;
      }
      if (!current || !visible || !validFrameUsage(session)) return;
      if (event.type === "hover" || event.type === "click")
        receiveInstance(session, event.key, event.boxes, event.type);
    },
    [
      clearInspection,
      geometry,
      inspection,
      picking,
      pickSessions,
      receiveInstance,
      report,
    ],
  );

  return { receive, receiveInstance };
}
