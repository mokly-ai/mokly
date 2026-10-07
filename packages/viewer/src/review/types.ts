import type { ColorScheme, Viewport } from "../data/axes.js";
import type { ManifestEntry } from "../registry/types.js";

import type { ReviewResultV6 } from "./component_types.js";

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

/** Attribution evidence for changed rules from eligible page style elements. */
export type InlineStyleEvidence =
  | { status: "matched" | "unresolved"; selectors: readonly string[] }
  | { status: "excluded" };

/** One view comparison, addressed only by its axes. */
export interface ViewReview {
  colorScheme: ColorScheme;
  ignoredIds: readonly string[];
  /** Present exactly when the view's actual comparison material differs. */
  material?: true;
  reasons?: readonly DependencyReason[];
  excludedResources?: readonly ExcludedResource[];
  inlineStyles?: InlineStyleEvidence;
  state: ReviewState;
  viewport: Viewport;
}

/** Classification evidence available without generating comparison snapshots. */
export type ViewResourceEvidence = Pick<
  ViewReview,
  "viewport" | "colorScheme" | "reasons" | "excludedResources" | "inlineStyles"
>;

/** Screen-only resource evidence retained by live classification. */
export interface ScreenResourceEvidence {
  path: string;
  views: readonly ViewResourceEvidence[];
}

/** One stable screen identity comparison. */
export interface ScreenReview {
  dependencies: readonly string[];
  path: string;
  sharedImpact: readonly string[];
  state: ReviewState;
  title: string;
  views: readonly ViewReview[];
}

/** Complete artifact file map plus summary model. */
export interface ReviewArtifact {
  files: ReadonlyMap<string, ReviewArtifactContent>;
  result: ReviewResult;
  /** Typed comparison metadata; documents and pages add no visual result records. */
  pairing?: {
    moves: readonly {
      kind: ManifestEntry["kind"];
      path: string;
      previousPath: string;
    }[];
    diagnostics: readonly string[];
  };
}

/** The only accepted comparison payload. */
export type ReviewResult = ReviewResultV6;
