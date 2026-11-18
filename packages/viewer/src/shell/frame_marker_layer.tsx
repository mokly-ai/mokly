/** Declarative host marker content backed by registry-owned frame geometry. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { viewerFailures } from "../host/failures.js";
import type { ViewerEvents, ViewerMarker } from "../host/types.js";

import { runCleanup } from "./cleanup.js";
import { useShellComparisonMode } from "./comparison_mode.js";
import { ShellFrameMarkers } from "./frame_markers.js";
import { useOptionalShellFrameRegistry } from "./frame_registry.js";
import { MarkerLayer } from "./marker_layer.js";
import { MarkerStore } from "./marker_store.js";
import { useShellRoot } from "./root_context.js";

interface MarkerRuntime {
  dispose(): void;
  sync(): void;
  update(markers: readonly ViewerMarker[]): void;
}

/** Render host marker React nodes while frame sessions supply placement only. */
export function ShellFrameMarkerLayer({
  markers,
  onError,
  onMarkerChange,
}: {
  markers: readonly ViewerMarker[];
  onError?: ViewerEvents["onError"];
  onMarkerChange?: ViewerEvents["onMarkerChange"];
}) {
  const shellRoot = useShellRoot();
  const elements = shellRoot?.elements;
  const root = shellRoot?.element;
  const mode = useShellComparisonMode();
  const currentMode = useRef(mode);
  currentMode.current = mode;
  const registry = useOptionalShellFrameRegistry();
  const [store] = useState(() => new MarkerStore());
  const localLayer = useRef<HTMLDivElement>(null);
  const layer = elements?.markers ?? localLayer;
  const runtime = useRef<MarkerRuntime | undefined>(undefined);
  const active = useRef(false);
  const latestMarkers = useRef(markers);
  const callbacks = useRef<ViewerEvents>(markerEvents(onError, onMarkerChange));
  callbacks.current = markerEvents(onError, onMarkerChange);
  latestMarkers.current = markers;
  const [report] = useState(() =>
    viewerFailures(
      () => callbacks.current,
      () => active.current,
    ),
  );

  useLayoutEffect(() => {
    const markerLayer = layer.current;
    if (!registry || !markerLayer || !root) return;
    active.current = true;
    const geometry = registry.geometry;
    const owner = new ShellFrameMarkers(
      root,
      geometry,
      () => registry.inspection.visibleSessions(),
      store,
      () => callbacks.current,
      (error) => report(error, "markers"),
      {
        current: () => currentMode.current === "current",
        layer: () => layer.current,
      },
    );
    const sync = () => {
      owner.changed();
      void geometry.refresh().catch(() => undefined);
    };
    const releaseGeometry = geometry.acquire(owner, root, owner.demand);
    const unsubscribeGeometry = geometry.subscribe(() => owner.changed());
    const unsubscribeRegistry = registry.subscribe(sync);
    let disposed = false;
    const current: MarkerRuntime = {
      sync,
      update: (next) => owner.update(next),
      dispose() {
        if (disposed) return;
        disposed = true;
        active.current = false;
        runCleanup([
          unsubscribeRegistry,
          unsubscribeGeometry,
          releaseGeometry,
          () => owner.dispose(),
          () => store.set([]),
        ]);
      },
    };
    runtime.current = current;
    try {
      initializeMarkerRuntime(current, latestMarkers.current);
    } catch (error) {
      if (runtime.current === current) runtime.current = undefined;
      throw error;
    }
    return () => {
      if (runtime.current === current) runtime.current = undefined;
      current.dispose();
    };
  }, [layer, registry, report, root, store]);

  useLayoutEffect(() => runtime.current?.sync());
  useEffect(() => runtime.current?.update(markers), [markers]);

  return <MarkerLayer layerRef={layer} markers={markers} store={store} />;
}

/** Start marker callbacks only after every cleanup owner is registered. */
export function initializeMarkerRuntime(
  runtime: MarkerRuntime,
  markers: readonly ViewerMarker[],
): void {
  try {
    runtime.sync();
    runtime.update(markers);
  } catch (error) {
    try {
      runtime.dispose();
    } catch {
      // Preserve the host callback exception that interrupted initialization.
    }
    throw error;
  }
}

function markerEvents(
  onError: ViewerEvents["onError"],
  onMarkerChange: ViewerEvents["onMarkerChange"],
): ViewerEvents {
  return {
    ...(onError ? { onError } : {}),
    ...(onMarkerChange ? { onMarkerChange } : {}),
  };
}
