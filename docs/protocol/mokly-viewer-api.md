# Embeddable Viewer API

These declarations define the props, event payloads, and imperative handle of
the [embeddable viewer contract](./mokly-viewer.md). The contract defines their
behavior and delivery rules.

```ts
import type { CSSProperties, ReactNode, Ref } from "react";
import type { CatalogueReadModel, EntryDetailV3 } from "@mokly/viewer";
import type { FrameAdapter, Box, FrameNavigation } from "@mokly/viewer";
import type { InstanceRef, ViewerMarker, MarkerState } from "@mokly/viewer";

interface ViewerSelection {
  /** Entry path of any kind, including a variant; null is home. */
  screenPath: string | null;
  /** Exact removed record; absent for current content. */
  snapshotId?: string;
  view: "all" | "changes";
  viewport: "mobile" | "desktop" | "both";
  colorScheme: "light" | "dark";
  search: string;
  tags: readonly string[];
}
/** The catalogue index v8 as an object, or its absolute HTTP(S) URL. */
type IndexSource = CatalogueReadModel | string | URL;
type DetailResult = EntryDetailV3 | string | URL;
/** One entry detail v3, or its URL; a removed entry names its snapshot. */
type DetailSource = (
  entryPath: string,
  snapshotId?: string,
) => DetailResult | Promise<DetailResult>;
interface InstanceEvent {
  instance: InstanceRef | null;
  boxes: readonly Box[];
  frame: { entryPath: string; stepIndex?: number };
}
interface ScreenNavigateEvent {
  screenPath: string;
  snapshotId?: string;
  fragment?: string;
  navigation?: FrameNavigation;
}
type PickEnd =
  | { reason: "selected"; instance: InstanceRef }
  | {
      reason:
        | "cancelled"
        | "escape"
        | "navigation"
        | "source-change"
        | "evidence"
        | "error";
    };
type ViewerError = import("@mokly/viewer").ViewerError;
type ViewerTheme = "auto" | "light" | "dark";
interface ViewerSlots {
  topBarStart?: ReactNode;
  topBarEnd?: ReactNode;
  railStart?: ReactNode;
  railEnd?: ReactNode;
  sidePanel?: { content: ReactNode; width: CSSProperties["width"] };
  stageOverlay?: { content: ReactNode; pointerEvents: "none" | "auto" };
  emptyState?: ReactNode;
}
interface MoklyViewerHandle {
  select(selection: Partial<ViewerSelection>): void;
  highlightInstance(instance: InstanceRef | null): Promise<void>;
  highlightInstances(instances: readonly InstanceRef[]): Promise<void>;
  scrollToInstance(instance: InstanceRef): Promise<void>;
  startPick(): Promise<void>;
  cancelPick(): void;
}
interface MoklyViewerProps {
  index: IndexSource;
  detail: DetailSource;
  baseUrl?: string | URL;
  frameAdapter?: FrameAdapter;
  defaultSelection?: Partial<ViewerSelection>;
  selection?: ViewerSelection;
  theme?: ViewerTheme;
  onSelectionChange?: (selection: ViewerSelection) => void;
  markers?: readonly ViewerMarker[];
  onMarkerChange?: (states: readonly MarkerState[]) => void;
  slots?: ViewerSlots;
  onScreenNavigate?: (event: ScreenNavigateEvent) => void;
  onInstanceHover?: (event: InstanceEvent) => void;
  onInstanceClick?: (event: InstanceEvent) => void;
  onPickStart?: () => void;
  onPickEnd?: (event: PickEnd) => void;
  onError?: (error: ViewerError) => void;
  ref?: Ref<MoklyViewerHandle>;
}
```
