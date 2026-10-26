/**
 * The comparison facts that entry details carry, and the shell's own
 * presentation of their evidence. The wire shapes are the generated types of
 * the model crate; the presentation types are views the shell derives.
 */

import type { ComponentWireProps } from "../components/prop_types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";
import type { EntryChangeReason } from "../generated/catalogue/EntryChangeReason.js";
import type { ResourceEvidence } from "../generated/catalogue/ResourceEvidence.js";
import type { ReviewState } from "../generated/catalogue/ReviewState.js";
import type { RuleEvidence } from "../generated/catalogue/RuleEvidence.js";

export type { EntryChangeReason } from "../generated/catalogue/EntryChangeReason.js";
export type { RemovedPagePreview } from "../generated/catalogue/RemovedPagePreview.js";
export type { ReviewEntryAddress } from "../generated/catalogue/ReviewEntryAddress.js";
export type { ReviewState } from "../generated/catalogue/ReviewState.js";

/** One ready view of a compared entry, from its detail: axes, state, ignore ids, and evidence. */
export interface ReviewView {
  viewport: Viewport;
  colorScheme: ColorScheme;
  state: ReviewState;
  ignoredIds: readonly string[];
  rules?: readonly RuleEvidence[];
  resources?: readonly ResourceEvidence[];
}

/** The routed entry's comparison facts, read from its detail while Changes is ready. */
export interface ComparedEntry {
  /** The current path, or the base path of a removed entry. */
  path: string;
  /** The base side's path: a moved entry's previous path or a renamed spelling. */
  basePath: string;
  /** Direct reasons, empty for a pure move or an entry outside Changes. */
  reasons: readonly EntryChangeReason[];
  /** The ready views in viewport and scheme order. */
  views: readonly ReviewView[];
  /** A component's saved props on both sides, when it has a base side. */
  savedProps?: { before: ComponentWireProps; after: ComponentWireProps };
}

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
