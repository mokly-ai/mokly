/** Production bridge harness for retained evidence, markers, and inspection. */

import { createRoot } from "react-dom/client";

import type {
  CatalogueReadModel,
  CatalogueUsage,
  CatalogueView,
} from "../src/catalogue/types.js";
import { postMessageAdapter } from "../src/client/post_message_adapter.js";
import { sameOriginAdapter } from "../src/client/same_origin_adapter.js";
import { ShellStoreProvider } from "../src/shell/store.js";
import { viewerShellEnvironment } from "../src/viewer/environment.js";
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
  ViewerMarker,
  ViewerSelection,
} from "../src/viewer/types.js";

import { evidenceAdapter } from "./evidence_frame_adapter.js";
import { EvidenceRuntime } from "./evidence_runtime.js";

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

export interface EvidenceRuntimeProbe extends EvidenceProbe {
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
        screenPath: home.path,
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
    screenPath: home.path,
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
