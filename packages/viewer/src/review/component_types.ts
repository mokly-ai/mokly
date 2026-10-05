import type { ComponentWireProps } from "../components/prop_types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

import type {
  DependencyReason,
  ReviewState,
  ScreenReview,
  ViewReview,
} from "./types.js";

export interface ReviewEntryAddress {
  path: string;
  title: string;
}
export interface ReviewEntrySides {
  before?: ReviewEntryAddress;
  after?: ReviewEntryAddress;
  previousPath?: string;
}
export interface ScreenReviewV6 extends ScreenReview, ReviewEntrySides {}
export interface ReviewVariantAddress {
  path: string;
  title: string;
  description?: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
}
export interface ComponentVariantReview {
  path: string;
  previousPath?: string;
  title: string;
  before?: ReviewVariantAddress;
  after?: ReviewVariantAddress;
  state: ReviewState;
  views: readonly ViewReview[];
}
export interface ComponentReview
  extends Omit<ScreenReview, "views">, ReviewEntrySides {
  variants: readonly ComponentVariantReview[];
}
export type EntryChangeReason =
  | {
      kind:
        "added" | "removed" | "metadata" | "material" | "inputs" | "structure";
    }
  | DependencyReason
  | { kind: "screen"; screenPath: string };
export interface ChangedEntry extends ReviewEntrySides {
  kind: "screen" | "component" | "use-case";
  reasons: readonly EntryChangeReason[];
}
export type ComponentUsageContext =
  | {
      kind: "screen";
      entry: ReviewEntryAddress;
      viewport: Viewport;
      colorScheme: ColorScheme;
    }
  | {
      kind: "component";
      entry: ReviewEntryAddress;
      variantPath: string;
      viewport: Viewport;
      colorScheme: ColorScheme;
    };
export interface AffectedUsageEvidence {
  side: "before" | "after";
  context: ComponentUsageContext;
  via: readonly { componentId: string; instanceKey: string }[];
}
export interface AffectedConsumer {
  changedComponentId: string;
  consumer:
    { kind: "screen"; path: string } | { kind: "component"; path: string };
  evidence: readonly AffectedUsageEvidence[];
}
export interface ReviewResultV6 {
  baseCommit: string;
  baseRef: string;
  changedPaths: readonly string[];
  ignoredImpact: readonly {
    colorScheme: ColorScheme;
    count: number;
    id: string;
    viewport: Viewport;
  }[];
  screens: readonly ScreenReviewV6[];
  schemaVersion: 6;
  sharedImpact: readonly string[];
  components: readonly ComponentReview[];
  changes: readonly ChangedEntry[];
  affectedConsumers: readonly AffectedConsumer[];
}
