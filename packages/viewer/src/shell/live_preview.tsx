/** Workspace-scoped Static/Live decisions, bundle preparation and frame wiring. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import type { FrameAdapter } from "../client/frame_adapter.js";
import type { ViewerCapabilityRequest } from "../client/host_capability_descriptor.js";

import {
  useViewerCapabilities,
  useViewerLiveState,
} from "./capability_context.js";
import { useOptionalShellFrameRegistry } from "./frame_registry.js";
import { liveFrameOrigin } from "./live_frame_source.js";
import {
  liveGenerationKey,
  livePreviewAvailability,
  livePreviewView,
  liveViewKey,
  type PreviewMode,
} from "./preview_mode.js";
import { useOptionalShellStore } from "./store_context.js";
import type { WorkspaceData } from "./workspace_data.js";
import type { WorkspaceVariantSelection } from "./workspace_selection.js";

/** What a Live stage frame needs from the workspace that selected Live. */
export interface LivePreviewFrameOptions {
  adapter: FrameAdapter;
  /** The generation's browser bundle is ready, so the frame may mount. */
  bundleReady: boolean;
  frameOrigin: string;
  /** Report a mount failure: Static is selected and Live disabled here. */
  unavailable(): void;
}

/** Toolbar state for a view that offers Static and Live. */
export interface PreviewModeChoice {
  live: boolean;
  select(mode: PreviewMode): void;
  unavailable: boolean;
}

/** Static/Live outcome for one routed workspace. */
export interface LivePreview {
  /** Absent when the catalogue, view or comparison offers no Static/Live. */
  control?: PreviewModeChoice;
  /** Frame wiring while Live is selected for the current view. */
  frame?: LivePreviewFrameOptions;
  /** Live is on screen, so inspection and prop editing wait for Static. */
  inspecting: boolean;
  /** Live is selected for the current view, including behind a comparison. */
  selected: boolean;
}

const LivePreviewFrameContext = createContext<
  LivePreviewFrameOptions | undefined
>(undefined);

/** Supply Live frame wiring to the current workspace stage only. */
export const LivePreviewFrameProvider = LivePreviewFrameContext.Provider;

/** Read Live frame wiring; flows, pages and Static stages receive nothing. */
export function useLivePreviewFrame(): LivePreviewFrameOptions | undefined {
  return useContext(LivePreviewFrameContext);
}

/** Decide Static/Live for one view and prepare its generation when needed. */
export function useLivePreview(input: {
  comparing: boolean;
  data: WorkspaceData;
  request: ViewerCapabilityRequest | undefined;
  selection: WorkspaceVariantSelection;
}): LivePreview {
  const store = useOptionalShellStore();
  const live = useViewerLiveState();
  const capabilities = useViewerCapabilities();
  const registry = useOptionalShellFrameRegistry();
  const storeRef = useRef(store);
  const requestRef = useRef(input.request);
  storeRef.current = store;
  requestRef.current = input.request;
  const descriptor = live.interactive;
  const adoptPreparation = live.adoptPreparation;
  const view = livePreviewView(input.data, input.selection);
  const availability = livePreviewAvailability({
    descriptor,
    unavailable: store?.state.liveUnavailable ?? [],
    view,
  });
  const requested = store?.state.previewMode === "live";
  const selected = requested && availability === "available";
  const generation = descriptor?.generation;
  const bundleFailed = descriptor?.state === "failed";
  const bundleReady = descriptor?.state === "ready";
  const viewKey = generation && view ? liveViewKey(generation, view) : "";
  const origin = descriptor?.origin;
  const port = descriptor?.port;

  const wiring = useMemo(() => {
    if (!selected || port === undefined || !registry) return;
    if (typeof window === "undefined") return;
    const frameOrigin = liveFrameOrigin(
      { port, ...(origin ? { origin } : {}) },
      window.location,
    );
    if (!frameOrigin) return;
    try {
      return { adapter: registry.liveAdapter(frameOrigin), frameOrigin };
    } catch {
      return;
    }
  }, [origin, port, registry, selected]);

  const unavailable = useCallback(() => {
    if (viewKey) storeRef.current?.markLiveUnavailable(viewKey);
  }, [viewKey]);

  useEffect(() => {
    if (selected && !wiring) unavailable();
  }, [selected, unavailable, wiring]);

  useEffect(() => {
    if (requested && bundleFailed && generation)
      storeRef.current?.markLiveUnavailable(liveGenerationKey(generation));
  }, [bundleFailed, generation, requested]);

  useEffect(() => {
    if (!selected || bundleReady || !generation || !capabilities) return;
    const request = requestRef.current;
    const preparation = capabilities.interactive;
    const failed = () =>
      storeRef.current?.markLiveUnavailable(liveGenerationKey(generation));
    if (!preparation || !request) {
      failed();
      return;
    }
    const controller = new AbortController();
    void preparation.prepare(request, generation, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        adoptPreparation?.(result);
        if (result.state === "failed") failed();
      },
      () => {
        if (!controller.signal.aborted) failed();
      },
    );
    return () => controller.abort();
  }, [
    adoptPreparation,
    bundleReady,
    capabilities,
    generation,
    selected,
    viewKey,
  ]);

  const select = useCallback(
    (mode: PreviewMode) => storeRef.current?.selectPreviewMode(mode),
    [],
  );
  const frame = useMemo(
    () =>
      selected && wiring ? { ...wiring, bundleReady, unavailable } : undefined,
    [bundleReady, selected, unavailable, wiring],
  );
  return {
    ...(availability === "none" || input.comparing
      ? {}
      : {
          control: {
            live: selected,
            select,
            unavailable: availability === "unavailable",
          },
        }),
    ...(frame ? { frame } : {}),
    inspecting: selected && !input.comparing,
    selected,
  };
}
