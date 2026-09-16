import type { CSSProperties, ReactNode, Ref } from "react";

import type { CatalogueReadModel } from "../catalogue/types.js";
import type {
  Box,
  FrameAdapter,
  FrameNavigation,
} from "../client/frame_adapter.js";

export interface ViewerSelection {
  screenId: string | null;
  view: "all" | "changes";
  viewport: "mobile" | "desktop" | "both";
  colorScheme: "light" | "dark";
  search: string;
  tags: readonly string[];
}
export type CatalogueFetcher = (context: {
  signal: AbortSignal;
}) => Promise<{ catalogue: CatalogueReadModel; url: URL }>;
export type CatalogueSource =
  CatalogueReadModel | string | URL | CatalogueFetcher;
export interface InstanceRef {
  screenId: string;
  variantId?: string;
  /** Required for a flow occurrence; absent for a standalone screen or component. */
  stepIndex?: number;
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  key: string;
}
export interface InstanceEvent {
  instance: InstanceRef | null;
  boxes: readonly Box[];
  frame: { entryId: string; stepIndex?: number };
}
export interface ScreenNavigateEvent {
  screenId: string;
  route: string;
  variantId?: string;
  fragment?: string;
  navigation?: FrameNavigation;
}
export type PickEnd =
  | { reason: "selected"; instance: InstanceRef }
  | {
      reason: "cancelled" | "escape" | "navigation" | "source-change" | "error";
    };
export interface ViewerError {
  code: "catalogue" | "selection" | "frame" | "comparison";
  message: string;
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
export type SourceProps =
  | { catalogue: CatalogueReadModel; baseUrl: string | URL }
  | {
      catalogue: Exclude<CatalogueSource, CatalogueReadModel>;
      baseUrl?: never;
    };
export type MoklyViewerProps = SourceProps &
  SelectionProps &
  ViewerEvents & {
    frameAdapter?: FrameAdapter;
    slots?: ViewerSlots;
    ref?: Ref<MoklyViewerHandle>;
  };
