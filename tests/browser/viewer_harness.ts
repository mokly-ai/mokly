import type {
  MoklyViewerHandle,
  MoklyViewerProps,
  ViewerMarker,
  ViewerSelection,
  ViewerTheme,
} from "@mokly/viewer";

export interface ViewerHost {
  ref: { current: MoklyViewerHandle };
  props: MoklyViewerProps;
  events: { name: string; value: unknown }[];
  render(): void;
  setMarkers(markers: readonly Omit<ViewerMarker, "content">[]): void;
  setSelection(value: ViewerSelection): void;
  setTheme(theme: ViewerTheme): void;
}
interface Harness {
  start(id: string, options?: Record<string, unknown>): ViewerHost;
  get(id: string): ViewerHost;
  remove(id: string): void;
}
interface ViewerHydrationHarness {
  recoverableErrors: string[];
  ready(): boolean;
  retained(): Record<string, { frame: boolean; shell: boolean }>;
}
interface FrameHookHarness {
  highlight(id: string): Promise<void>;
  ready(id: string): Promise<string>;
  rejectMount(id: string): void;
  rejectUpdate(id: string): void;
  replaceDocument(id: string, kind: "identity" | "source"): void;
  remove(id: string): void;
  renderUsage(
    id: string,
    status: "pending" | "unavailable",
    snapshot?: string,
  ): void;
  rerender(id: string): void;
  resolveMount(id: string): void;
  resolveUpdate(id: string): void;
  snapshot(id: string): {
    activeSubscriptions: number;
    disposals: number;
    mounts: number;
    pendingMounts: number;
    pendingUpdates: number;
    sessions: number;
    status: string;
    highlightedKeys: string[];
    updateStatuses: string[];
    usageRevision: number;
    usageStatus: string | undefined;
  };
  start(
    id: string,
    options?: {
      deferredMount?: boolean;
      deferredUpdates?: boolean;
      generatedUsage?: boolean;
      strict?: boolean;
      supportsUsageUpdates?: boolean;
    },
  ): void;
}
declare global {
  interface Window {
    frameHookHarness: FrameHookHarness;
    viewerHarness: Harness;
    viewerHydrationHarness: ViewerHydrationHarness;
  }
}
