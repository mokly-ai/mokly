import type { ColorScheme, Viewport } from "../data/axes.js";

import type { ReviewResultV3 } from "./component_types.js";

/** Text or binary bytes retained in one static Review artifact. */
export type ReviewArtifactContent = string | Uint8Array;

/** Classification for one view or aggregate screen. */
export type ReviewState =
  "added" | "changed" | "ignored-only" | "removed" | "unchanged";

/** Potential impact from the changed rules of one reachable stylesheet. */
export interface DependencyAnalysis {
  status: "matched" | "unresolved";
  selectors: readonly string[];
}

/** A changed resource retained as dependency evidence. */
export interface DependencyReason {
  kind: "dependency";
  path: string;
  analysis?: DependencyAnalysis;
}

/** A reachable changed stylesheet whose changed rules cannot match this view. */
export interface ExcludedResource {
  path: string;
  reason: "no-matching-rule";
}

/** One view comparison and its retained artifact paths. */
export interface ViewReview {
  afterPath?: string;
  beforePath?: string;
  colorScheme: ColorScheme;
  ignoredIds: readonly string[];
  /** Present exactly when the paired ignore-normalized documents differ. */
  material?: true;
  reasons?: readonly DependencyReason[];
  excludedResources?: readonly ExcludedResource[];
  state: ReviewState;
  viewport: Viewport;
}

/** Classification evidence available without generating comparison snapshots. */
export type ViewResourceEvidence = Pick<
  ViewReview,
  "viewport" | "colorScheme" | "reasons" | "excludedResources"
>;

/** Screen-only resource evidence retained by the existing live classification. */
export interface ScreenResourceEvidence {
  route: string;
  views: readonly ViewResourceEvidence[];
}

/** One stable screen route comparison. */
export interface ScreenReview {
  dependencies: readonly string[];
  id: string;
  route: string;
  sharedImpact: readonly string[];
  state: ReviewState;
  title: string;
  views: readonly ViewReview[];
}

/** Deterministic machine-readable Review result. */
export interface ReviewResultV2 {
  /** Common ancestor shared by HEAD and the configured base ref. */
  baseCommit: string;
  /** Configured ref used to resolve the comparison branch point. */
  baseRef: string;
  changedPaths: readonly string[];
  ignoredImpact: readonly {
    colorScheme: ColorScheme;
    count: number;
    id: string;
    viewport: Viewport;
  }[];
  screens: readonly ScreenReview[];
  schemaVersion: 2;
  sharedImpact: readonly string[];
}

/** Complete artifact file map plus summary model. */
export interface ReviewArtifact {
  files: ReadonlyMap<string, ReviewArtifactContent>;
  result: ReviewResult;
}

/** Versioned comparison payload; legacy consumers retain schema v2. */
export type ReviewResult = ReviewResultV2 | ReviewResultV3;
