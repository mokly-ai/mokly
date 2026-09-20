/** Production bridge harness for retained evidence, markers, and inspection. */

import { useRef, useState } from "react";
import type { RefObject } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type {
  CatalogueReadModel,
  CatalogueScreen,
  CatalogueUsage,
  CatalogueView,
} from "../src/catalogue/types.js";
import { postMessageAdapter } from "../src/client/post_message_adapter.js";
import { sameOriginAdapter } from "../src/client/same_origin_adapter.js";
import { ShellFrameMarkerLayer } from "../src/shell/frame_marker_layer.js";
import { ShellStoreProvider } from "../src/shell/store.js";
import { viewerShellEnvironment } from "../src/viewer/environment.js";
import { ViewerHostBridge } from "../src/viewer/host_bridge.js";
import type { MarkerPlacement } from "../src/viewer/marker_store.js";
import {
  viewerCatalogue,
  viewerContext,
  viewerView,
} from "../src/viewer/projection.js";
import type { LoadedCatalogue } from "../src/viewer/source.js";
import type {
  InstanceRef,
  MarkerState,
  MoklyViewerHandle,
  MoklyViewerProps,
  ViewerMarker,
  ViewerSelection,
} from "../src/viewer/types.js";

import { evidenceAdapter } from "./evidence_frame_adapter.js";
import { RegistryHarnessFrame } from "./frame_registry_harness.js";

export type EvidenceStatus = "ready" | "empty" | "pending" | "unavailable";
export type EvidenceViewport = "mobile" | "desktop";

export interface EvidenceFrames {
  cancelPick(): void;
  highlight(instance: InstanceRef | null): Promise<void>;
  highlightInstances(instances: readonly InstanceRef[]): Promise<void>;
  startPick(): Promise<void>;
}

export interface EvidenceProbe {
  frames: EvidenceFrames;
  instance: InstanceRef;
  instances: readonly InstanceRef[];
  events: string[];
  calls: string[];
  mounts: number;
  updates: number;
  markerErrors: number;
  markerPlacements: readonly MarkerPlacement[];
  markerStates: readonly MarkerState[];
  hold?: "highlight" | "list";
  geometryDuringHighlight: boolean;
  geometryDuringList: boolean;
  waiting: boolean;
  release(): void;
  outcome?: string;
  setMarkers(instances?: readonly InstanceRef[]): void;
  update(viewport: EvidenceViewport, evidence?: EvidenceStatus): void;
}

interface EvidenceRuntimeProbe extends EvidenceProbe {
  setMarkersState?: (markers: readonly ViewerMarker[]) => void;
  setUsage?: (viewport: EvidenceViewport, usage: CatalogueUsage) => void;
}

/** Mount the new registry owners with the same observable fixture controls. */
export function startEvidenceHarness(
  model: CatalogueReadModel,
  origin: string,
  cross: boolean,
  sibling: "ready" | "pending" | "unavailable",
): EvidenceProbe {
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  const home = model.screens[0]!;
  const original = home.views.map((view) => ({ ...view }));
  const mobile = original.find((view) => view.viewport === "mobile")!;
  if (mobile.usage.status !== "ready")
    throw new Error("Expected ready fixture");
  const instances = original
    .filter((view) => view.colorScheme === "light")
    .map((view): InstanceRef => {
      if (view.usage.status !== "ready")
        throw new Error("Expected ready fixture");
      return {
        screenId: home.id,
        viewport: view.viewport,
        colorScheme: view.colorScheme,
        key: view.usage.instances.find((instance) => instance.id === "action")!
          .key,
      };
    });
  const probe: EvidenceRuntimeProbe = {
    frames: emptyFrames,
    instance: instances[0]!,
    instances,
    events: [],
    calls: [],
    mounts: 0,
    updates: 0,
    markerErrors: 0,
    markerPlacements: [],
    markerStates: [],
    geometryDuringHighlight: false,
    geometryDuringList: false,
    waiting: false,
    release: () => undefined,
    setMarkers(values = [probe.instance]) {
      probe.setMarkersState?.(
        values.map((instance, index) => ({
          id: `marker-${index}`,
          instance,
          content: null,
        })),
      );
    },
    update(viewport, evidence = "ready") {
      const usage = evidenceUsage(original, viewport, evidence);
      probe.setUsage?.(viewport, usage);
    },
  };
  const selected = cross
    ? postMessageAdapter({ frameOrigin: origin })
    : sameOriginAdapter();
  const adapter = evidenceAdapter(selected, probe);
  const baseUrl = cross ? origin : location.origin;
  const loaded: LoadedCatalogue = {
    catalogue: model,
    url: new URL("/", baseUrl),
  };
  const selection: ViewerSelection = {
    colorScheme: "light",
    screenId: home.id,
    search: "",
    tags: [],
    view: "all",
    viewport: "both",
  };
  const catalogue = viewerCatalogue(model);
  const initial = Object.fromEntries(
    original.map((view) => [
      view.viewport,
      view.viewport === "desktop" && sibling !== "ready"
        ? ({ status: sibling } satisfies CatalogueUsage)
        : view.usage,
    ]),
  ) as Record<EvidenceViewport, CatalogueUsage>;
  createRoot(root).render(
    <ShellStoreProvider
      catalogue={catalogue}
      context={viewerContext(model, selection)}
      embeddedHost={viewerShellEnvironment(
        loaded,
        selection,
        false,
        () => ({}),
        () => undefined,
      )}
      frameAdapter={adapter}
      frameBaseUrl={loaded.url}
      interactive
      view={viewerView(catalogue, selection)}
    >
      <EvidenceRuntime
        home={home}
        initial={initial}
        loaded={loaded}
        model={model}
        probe={probe}
        views={original}
      />
    </ShellStoreProvider>,
  );
  return probe;
}

function EvidenceRuntime({
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
      screenId: home.id,
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

function evidenceUsage(
  views: readonly CatalogueView[],
  viewport: EvidenceViewport,
  status: EvidenceStatus,
): CatalogueUsage {
  if (status === "ready")
    return structuredClone(
      views.find((view) => view.viewport === viewport)!.usage,
    );
  if (status === "empty")
    return { status: "ready", instances: [], slots: [], ranges: [] };
  return { status };
}

const emptyFrames: EvidenceFrames = {
  cancelPick: () => undefined,
  highlight: async () => undefined,
  highlightInstances: async () => undefined,
  startPick: async () => undefined,
};

function requiredHandle(
  handle: RefObject<MoklyViewerHandle | null>,
): MoklyViewerHandle {
  if (!handle.current) throw new Error("Expected the production viewer handle");
  return handle.current;
}

function sourceReplaced(): boolean {
  return false;
}
