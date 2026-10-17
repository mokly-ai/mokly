/**
 * The review result v8 that the comparison routes deliver, and the shell's
 * own presentation of its evidence. The wire shapes are the generated types
 * of the model crate; the presentation types are views the shell derives.
 */

import type { ColorScheme, Viewport } from "../data/axes.js";
import type { EntryChangeReason } from "../generated/catalogue/EntryChangeReason.js";
import type { ReviewResultV8 } from "../generated/catalogue/ReviewResultV8.js";

export type { AffectedConsumer } from "../generated/catalogue/AffectedConsumer.js";
export type { AffectedUsageEvidence } from "../generated/catalogue/AffectedUsageEvidence.js";
export type { ComponentUsageContext } from "../generated/catalogue/ComponentUsageContext.js";
export type { EntryChangeReason } from "../generated/catalogue/EntryChangeReason.js";
export type { RemovedPagePreview } from "../generated/catalogue/RemovedPagePreview.js";
export type { ReviewDiagnostic } from "../generated/catalogue/ReviewDiagnostic.js";
export type { ReviewEntry } from "../generated/catalogue/ReviewEntry.js";
export type { ReviewEntryAddress } from "../generated/catalogue/ReviewEntryAddress.js";
export type { ReviewKind } from "../generated/catalogue/ReviewKind.js";
export type { ReviewState } from "../generated/catalogue/ReviewState.js";
export type { ReviewView } from "../generated/catalogue/ReviewView.js";

/** The only accepted comparison payload. */
export type ReviewResult = ReviewResultV8;
export type { ReviewResultV8 };

/** Potential impact from the changed rules of one reachable stylesheet. */
export interface CssRuleAttribution {
  ruleKey?: string;
  status: "matched" | "unresolved";
  selectors: readonly string[];
  changedComponentPaths: readonly string[];
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

/** A changed resource shown as dependency evidence, with its CSS analysis. */
export interface DependencyReason {
  kind: "dependency";
  path: string;
  analysis?: DependencyAnalysis;
}

/** A reason as the shell presents it: a stylesheet carries its analysis. */
export type ChangeReason =
  Exclude<EntryChangeReason, { kind: "dependency" }> | DependencyReason;

/** A reachable changed stylesheet whose changed rules cannot match this view. */
export interface ExcludedResource {
  path: string;
  reason: "no-matching-rule";
}

/** The dependency reasons and exclusions one view's or page's records prove. */
export interface EvidenceReasons {
  reasons?: readonly DependencyReason[];
  excludedResources?: readonly ExcludedResource[];
}

/** One view's presented evidence, addressed by its axes. */
export interface ViewResourceEvidence extends EvidenceReasons {
  viewport: Viewport;
  colorScheme: ColorScheme;
}
