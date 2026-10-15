import type { CSSProperties, ReactNode, Ref } from "react";

import type { CatalogueReadModel } from "../catalogue/types.js";
import type {
  Box,
  FrameAdapter,
  FrameNavigation,
} from "../client/frame_adapter.js";

import type { DetailSource, IndexSource } from "./sources.js";

export type { DetailResult, DetailSource, IndexSource } from "./sources.js";

export interface ViewerSelection {
  screenPath: string | null;
  /** Exact removed record; absent selects current or uniquely identified history. */
  snapshotId?: string | undefined;
  view: "all" | "changes";
  viewport: "mobile" | "desktop" | "both";
  colorScheme: "light" | "dark";
  search: string;
  tags: readonly string[];
}
export interface InstanceRef {
  screenPath: string;
  /** Required for a flow occurrence; absent for a standalone screen or component. */
  stepIndex?: number;
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  key: string;
}
export interface InstanceEvent {
  instance: InstanceRef | null;
  boxes: readonly Box[];
  frame: { entryPath: string; stepIndex?: number };
}
export interface ViewerMarker {
  id: string;
  instance: InstanceRef;
  content: ReactNode;
}
export type MarkerStatus = "visible" | "hidden" | "unavailable";
export interface MarkerState {
  id: string;
  status: MarkerStatus;
}
export interface ScreenNavigateEvent {
  screenPath: string;
  /** Present exactly when the committed destination is historical content. */
  snapshotId?: string;
  fragment?: string;
  navigation?: FrameNavigation;
}
export type PickEnd =
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
export interface ViewerError {
  code:
    "catalogue" | "version" | "selection" | "frame" | "comparison" | "markers";
  message: string;
  /** Version diagnostics for a host's details surface, separate from product copy. */
  details?: string;
}
export interface ViewerSlots {
  topBarStart?: ReactNode;
  topBarEnd?: ReactNode;
  railStart?: ReactNode;
  railEnd?: ReactNode;
  sidePanel?: { content: ReactNode; width: CSSProperties["width"] };
  stageOverlay?: { content: ReactNode; pointerEvents: "none" | "auto" };
  emptyState?: ReactNode;
}
export interface MoklyViewerHandle {
  select(selection: Partial<ViewerSelection>): void;
  highlightInstance(instance: InstanceRef | null): Promise<void>;
  highlightInstances(instances: readonly InstanceRef[]): Promise<void>;
  scrollToInstance(instance: InstanceRef): Promise<void>;
  startPick(): Promise<void>;
  cancelPick(): void;
}
export interface ViewerEvents {
  onSelectionChange?: (selection: ViewerSelection) => void;
  onScreenNavigate?: (event: ScreenNavigateEvent) => void;
  onInstanceHover?: (event: InstanceEvent) => void;
  onInstanceClick?: (event: InstanceEvent) => void;
  onPickStart?: () => void;
  onPickEnd?: (event: PickEnd) => void;
  onMarkerChange?: (states: readonly MarkerState[]) => void;
  onError?: (error: ViewerError) => void;
}
export type SelectionProps =
  | {
      selection: ViewerSelection;
      onSelectionChange: (selection: ViewerSelection) => void;
      defaultSelection?: never;
    }
  | {
      selection?: never;
      defaultSelection?: Partial<ViewerSelection>;
      onSelectionChange?: (selection: ViewerSelection) => void;
    };
/**
 * The catalogue index v7 as an object with its artifact origin, or its
 * absolute HTTP(S) URL; and the detail source of every entry.
 */
export type SourceProps = { detail: DetailSource } & (
  | { index: CatalogueReadModel; baseUrl: string | URL }
  | { index: Exclude<IndexSource, CatalogueReadModel>; baseUrl?: never }
);

/**
 * Appearance of the interface around previews. `auto` follows the reader's
 * preferred color scheme and remains independent of preview selection.
 */
export type ViewerTheme = "auto" | "dark" | "light";

export type MoklyViewerProps = SourceProps &
  SelectionProps &
  ViewerEvents & {
    /** Interface appearance; omission means `auto`. */
    theme?: ViewerTheme;
    frameAdapter?: FrameAdapter;
    markers?: readonly ViewerMarker[];
    slots?: ViewerSlots;
    ref?: Ref<MoklyViewerHandle>;
  };
