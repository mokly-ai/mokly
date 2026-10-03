import type { ColorScheme, Viewport } from "../data/axes.js";

import type { ReviewResultV5 } from "./component_types.js";

/** Text or binary bytes retained in one static Review artifact. */
export type ReviewArtifactContent = string | Uint8Array;

/** Classification for one view or aggregate screen. */
export type ReviewState =
  "added" | "changed" | "ignored-only" | "removed" | "unchanged";

/** Potential impact from the changed rules of one reachable stylesheet. */
export interface CssRuleAttribution {
  ruleKey?: string;
  status: "matched" | "unresolved";
  selectors: readonly string[];
  changedComponentIds: readonly string[];
  pageSelectors: readonly string[];
}

export interface CssPageEvidence {
  selectors: readonly string[];
  unresolved?: true;
}

export interface DependencyAnalysis {
  status: "matched" | "unresolved";
  selectors: readonly string[];
  rules: readonly CssRuleAttribution[];
  pageEvidence?: CssPageEvidence;
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

/** One view comparison, addressed only by its axes. */
export interface ResourceEvidence {
  reasons?: readonly DependencyReason[];
  excludedResources?: readonly ExcludedResource[];
}

export interface ViewReview extends ResourceEvidence {
  colorScheme: ColorScheme;
  ignoredIds: readonly string[];
  /** Present exactly when the paired ignore-normalized documents differ. */
  material?: true;
  state: ReviewState;
  viewport: Viewport;
}

/** Classification evidence available without generating comparison snapshots. */
export type ViewResourceEvidence = Pick<
  ViewReview,
  "viewport" | "colorScheme" | "reasons" | "excludedResources"
>;

/** Screen-only resource evidence retained by live classification. */
export interface ScreenResourceEvidence {
  id: string;
  views: readonly ViewResourceEvidence[];
}

/** Single-document evidence, outside visual comparison records. */
export interface PageResourceEvidence extends ResourceEvidence {
  id: string;
}

/** One stable screen identity comparison. */
export interface ScreenReview {
  id: string;
  state: ReviewState;
  title: string;
  views: readonly ViewReview[];
}

/** Complete artifact file map plus summary model. */
export interface ReviewArtifact {
  files: ReadonlyMap<string, ReviewArtifactContent>;
  result: ReviewResult;
}

/** The only accepted comparison payload. */
export type ReviewResult = ReviewResultV5;
