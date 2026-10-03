import type { ComponentWireProps } from "../components/prop_types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

import type {
  DependencyReason,
  ReviewState,
  ScreenReview,
  ViewReview,
} from "./types.js";

export interface ReviewEntryAddress {
  id: string;
  title: string;
}
export interface ReviewEntrySides {
  before?: ReviewEntryAddress;
  after?: ReviewEntryAddress;
}
export interface ScreenReviewV4 extends ScreenReview, ReviewEntrySides {}
export interface ReviewVariantAddress {
  id: string;
  title: string;
  description?: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
}
export interface ComponentVariantReview {
  id: string;
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
  | { kind: "screen"; id: string };
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
      variantId: string;
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
  consumer: { kind: "screen"; id: string } | { kind: "component"; id: string };
  evidence: readonly AffectedUsageEvidence[];
}
export interface ReviewResultV4 {
  baseCommit: string;
  baseRef: string;
  changedPaths: readonly string[];
  ignoredImpact: readonly {
    colorScheme: ColorScheme;
    count: number;
    id: string;
    viewport: Viewport;
  }[];
  screens: readonly ScreenReviewV4[];
  schemaVersion: 4;
  sharedImpact: readonly string[];
  components: readonly ComponentReview[];
  changes: readonly ChangedEntry[];
  affectedConsumers: readonly AffectedConsumer[];
}
