import type { GeneratedPathPrefix } from "../catalogue/delivery_paths.js";
import type { CatalogueUsage } from "../catalogue/types.js";

/** Finite CSS pixels in the immediate frame's visible content viewport. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface InstanceBoundary {
  key: string;
  ranges: readonly { id: string; boxes: readonly Box[] }[];
}
export interface FrameMount {
  generatedPathPrefix?: GeneratedPathPrefix;
  route?: string;
  /** Cancel a pending mount or its active session. */
  signal?: AbortSignal;
  /** Receive events from the visible document while the adapter mounts. */
  onEvent?: (event: FrameEvent) => void;
  url: URL;
  usage: CatalogueUsage;
}
export type NavigationTarget =
  | { kind: "self" | "top" | "parent" | "blank" }
  | { kind: "named"; name: string };
export interface FrameNavigation {
  id: string;
  fragment?: string;
  target: NavigationTarget;
  activation: "primary" | "modified" | "middle";
}
export type FrameErrorCode =
  | "origin"
  | "timeout"
  | "unavailable"
  | "invalid-message"
  | "invalid-boundary"
  | "limit"
  | "missing-instance"
  | "disposed";
export type FrameEvent =
  | { type: "hover"; key: string | null; boxes: readonly Box[] }
  | { type: "click"; key: string; boxes: readonly Box[] }
  | { type: "navigation"; navigation: FrameNavigation }
  | { type: "pick-end"; reason: "escape" }
  | { type: "geometry" }
  | { type: "error"; code: FrameErrorCode };
export interface MountedFrame {
  /** Refresh validated usage for the same document without replacing its session. */
  updateUsage?(usage: CatalogueUsage): Promise<void>;
  listInstanceBoundaries(): Promise<readonly InstanceBoundary[]>;
  highlight(
    keys: readonly string[],
    mode: "off" | "highlight" | "pick",
  ): Promise<void>;
  scrollTo(key: string): Promise<void>;
  subscribe(listener: (event: FrameEvent) => void): () => void;
  dispose(): void;
}
export interface FrameAdapter {
  mount(frame: HTMLIFrameElement, view: FrameMount): Promise<MountedFrame>;
}
