/** Mounted frames and inspection controls used by the evidence harness. */

import type { RefObject } from "react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import type {
  CatalogueReadModel,
  CatalogueScreen,
  CatalogueUsage,
  CatalogueView,
} from "../src/catalogue/types.js";
import { ShellFrameMarkerLayer } from "../src/shell/frame_marker_layer.js";
import { ViewerHostBridge } from "../src/viewer/host_bridge.js";
import type { LoadedCatalogue } from "../src/viewer/source.js";
import type {
  MoklyViewerHandle,
  MoklyViewerProps,
  ViewerMarker,
} from "../src/viewer/types.js";

import type {
  EvidenceRuntimeProbe,
  EvidenceViewport,
} from "./evidence_harness.js";
import { RegistryHarnessFrame } from "./frame_registry_harness.js";

export function EvidenceRuntime({
  home,
  initial,
  loaded,
  model,
  probe,
  views,
}: {
  home: CatalogueScreen;
  initial: Record<EvidenceViewport, CatalogueUsage>;
  loaded: LoadedCatalogue;
  model: CatalogueReadModel;
  probe: EvidenceRuntimeProbe;
  views: readonly CatalogueView[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const handle = useRef<MoklyViewerHandle>(null);
  const failureOwner = useRef({});
  const navigationEnd = useRef<(() => void) | undefined>(undefined);
  const [usages, setUsages] = useState(initial);
  const [markers, setMarkers] = useState<readonly ViewerMarker[]>([]);
  const callbacks = useRef<MoklyViewerProps>({
    viewerId: "evidence",
    baseUrl: loaded.url,
    catalogue: model,
    defaultSelection: {
      colorScheme: "light",
      screenPath: home.path,
      viewport: "both",
    },
    onError: () => probe.events.push("error"),
    onInstanceClick: ({ instance }) => {
      if (instance) probe.events.push(`click:${instance.viewport}`);
    },
    onInstanceHover: ({ instance }) => {
      if (instance) probe.events.push(`hover:${instance.viewport}`);
    },
    onPickEnd: ({ reason }) => probe.events.push(`end:${reason}`),
    onPickStart: () => probe.events.push("start"),
  });
  probe.frames = {
    cancelPick: () => handle.current?.cancelPick(),
    highlight: (instance) => requiredHandle(handle).highlightInstance(instance),
    highlightInstances: (instances) =>
      requiredHandle(handle).highlightInstances(instances),
    startPick: () => requiredHandle(handle).startPick(),
  };
  probe.setMarkersState = setMarkers;
  probe.setUsage = (viewport, usage) =>
    flushSync(() =>
      setUsages((current) => ({ ...current, [viewport]: usage })),
    );
  const selected = views.filter((view) => view.colorScheme === "light");
  return (
    <div
      className="mokly-viewer"
      data-mokly-shell=""
      ref={root}
      style={{ height: 320, position: "relative", width: 800 }}
      tabIndex={-1}
    >
      <style>
        {
          "[data-mokly-marker-layer]{position:absolute;inset:0;pointer-events:none}"
        }
      </style>
      {selected.map((view) => (
        <div
          data-workspace-preview=""
          key={view.viewport}
          style={{ display: "inline-block", height: 300, width: 390 }}
        >
          <RegistryHarnessFrame
            entry={home}
            onEvent={() => undefined}
            usage={usages[view.viewport]}
            view={view}
          />
        </div>
      ))}
      <ShellFrameMarkerLayer
        markers={markers}
        onError={() => probe.markerErrors++}
        onMarkerChange={(states) => {
          probe.markerStates = states;
          probe.markerPlacements = states.map(({ id, status }) => ({
            id,
            status,
          }));
        }}
      />
      <ViewerHostBridge
        callbacks={callbacks}
        failureOwner={failureOwner.current}
        handleRef={handle}
        loaded={loaded}
        navigationEnd={navigationEnd}
        replaced={sourceReplaced}
        root={root}
      />
    </div>
  );
}

function requiredHandle(
  handle: RefObject<MoklyViewerHandle | null>,
): MoklyViewerHandle {
  if (!handle.current) throw new Error("Expected the production viewer handle");
  return handle.current;
}

function sourceReplaced(): boolean {
  return false;
}
