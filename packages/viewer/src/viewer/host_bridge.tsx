/** Public viewer handle and event bridge over the shared shell frame registry. */

import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject, RefObject } from "react";
import { flushSync } from "react-dom";

import {
  useOptionalShellFrameRegistry,
  useOptionalShellInspectionController,
  type ShellFrameSession,
} from "../shell/frame_registry.js";
import { useShellStore } from "../shell/store_context.js";

import { viewerFailures } from "./failures.js";
import { useHostBridgeEvents } from "./host_bridge_events.js";
import {
  useViewerEvidenceRestoration,
  viewerInstanceSessions,
} from "./host_bridge_evidence.js";
import { useHostBridgeLifecycle } from "./host_bridge_lifecycle.js";
import { activateViewerPick } from "./host_bridge_pick.js";
import { ViewerInspectionGeometryOwnership } from "./inspection_geometry_ownership.js";
import {
  ViewerInspectionLayer,
  type ViewerInspectionPresentation,
} from "./inspection_layer.js";
import { ObsoleteInspection } from "./inspection_work.js";
import { Picking } from "./picking.js";
import type { LoadedCatalogue } from "./source.js";
import type { MoklyViewerHandle, MoklyViewerProps, PickEnd } from "./types.js";

interface HostBridgeProps {
  callbacks: MutableRefObject<MoklyViewerProps>;
  failureOwner: object;
  handleRef: MoklyViewerProps["ref"];
  loaded: LoadedCatalogue;
  navigationEnd: MutableRefObject<(() => void) | undefined>;
  replaced(): boolean;
  root: RefObject<HTMLElement | null>;
}

/** Translate registry sessions into the stable public viewer contract. */
export function ViewerHostBridge({
  callbacks,
  failureOwner,
  handleRef,
  loaded,
  navigationEnd,
  replaced,
  root,
}: HostBridgeProps) {
  const registry = useOptionalShellFrameRegistry();
  const inspection = useOptionalShellInspectionController();
  const geometry = useMemo(
    () => new ViewerInspectionGeometryOwnership(registry),
    [registry],
  );
  const store = useShellStore();
  const latestStore = useRef(store);
  const active = useRef(false);
  const [presentation, setPresentation] = useState<
    ViewerInspectionPresentation | undefined
  >(undefined);
  const presentationRef = useRef(presentation);
  const operation = useRef(0);
  const pendingOperation = useRef(0);
  const pendingSessions = useRef<ReadonlySet<ShellFrameSession> | undefined>(
    undefined,
  );
  const pickSessions = useRef<ReadonlySet<ShellFrameSession> | undefined>(
    undefined,
  );
  latestStore.current = store;
  const [report] = useState(() =>
    viewerFailures(
      () => callbacks.current,
      () => active.current,
    ),
  );
  const reportFrameError = useCallback(
    (error: unknown) => {
      report(error, "frame");
    },
    [report],
  );
  const publishPresentation = useCallback(
    (next: ViewerInspectionPresentation | undefined) => {
      presentationRef.current = next;
      setPresentation(next);
    },
    [],
  );
  const picking = useMemo(
    () =>
      new Picking(
        () => callbacks.current,
        () => active.current,
        () => {
          pendingSessions.current = undefined;
          pickSessions.current = undefined;
          inspection?.cancelPick();
          geometry.clear();
          publishPresentation(undefined);
        },
        (error) => report(error, "frame"),
      ),
    [geometry, inspection, publishPresentation, report],
  );

  const clearInspection = useCallback(
    (reason?: PickEnd) => {
      const owned =
        presentationRef.current !== undefined ||
        pendingOperation.current !== 0 ||
        picking.active ||
        picking.activating;
      operation.current += 1;
      pendingOperation.current = 0;
      pendingSessions.current = undefined;
      geometry.clear();
      picking.end(reason);
      publishPresentation(undefined);
      if (inspection && owned)
        void inspection.highlightInstances([]).catch(() => undefined);
    },
    [geometry, inspection, picking, publishPresentation],
  );

  const { receive, receiveInstance } = useHostBridgeEvents({
    callbacks,
    clearInspection,
    geometry,
    inspection,
    picking,
    pickSessions,
    report,
    selectedEntryId: store.state.selection.screenId,
  });

  const evidenceChanged = useViewerEvidenceRestoration({
    active,
    clearInspection,
    geometry,
    inspection,
    operation,
    pendingOperation,
    pendingSessions,
    picking,
    pickSessions,
    presentation: presentationRef,
    registry,
  });

  useHostBridgeLifecycle({
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
  });

  const highlightInstances = useCallback(
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

  useImperativeHandle(
    handleRef,
    (): MoklyViewerHandle => ({
      select(selection) {
        try {
          flushSync(() => latestStore.current.select(selection));
        } catch (error) {
          throw report(error, "selection");
        }
      },
      highlightInstance: (instance) =>
        highlightInstances(instance ? [instance] : []),
      highlightInstances,
      async scrollToInstance(instance) {
        if (!inspection) throw new Error("The viewer is not ready.");
        try {
          await inspection.scrollToInstance(instance);
        } catch (error) {
          throw report(error, "frame");
        }
      },
      startPick: () =>
        picking.start((current) =>
          activateViewerPick({
            current,
            geometry,
            inspection,
            pendingSessions,
            pickSessions,
            publish: publishPresentation,
            registry,
            root,
          }),
        ),
      cancelPick: () => {
        if (picking.active || picking.activating)
          clearInspection({ reason: "cancelled" });
      },
    }),
    [
      handleRef,
      highlightInstances,
      clearInspection,
      geometry,
      inspection,
      picking,
      publishPresentation,
      report,
      root,
    ],
  );

  if (!registry) return <div data-mokly-label-layer="" />;
  return (
    <ViewerInspectionLayer
      model={loaded.catalogue}
      onError={reportFrameError}
      onSelect={(session, key, boxes) =>
        receiveInstance(session, key, boxes, "click")
      }
      registry={registry}
      {...(presentation ? { presentation } : {})}
    />
  );
}
