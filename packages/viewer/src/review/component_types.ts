import type { ManifestComponentVariant } from "../components/manifest_types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

import type {
  DependencyReason,
  ReviewResultV2,
  ReviewState,
  ScreenReview,
  ViewReview,
} from "./types.js";

export interface ReviewEntryAddress {
  id: string;
  route: string;
  title: string;
}
export interface ReviewEntrySides {
  before?: ReviewEntryAddress;
  after?: ReviewEntryAddress;
}
export interface ScreenReviewV3 extends ScreenReview, ReviewEntrySides {}
export type ReviewVariantAddress = Pick<
  ManifestComponentVariant,
  "id" | "title" | "description" | "props" | "suppliedSlots"
>;
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
  | { kind: "screen"; route: string };
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
  consumer:
    { kind: "screen"; route: string } | { kind: "component"; id: string };
  evidence: readonly AffectedUsageEvidence[];
}
export interface ReviewResultV3 extends Omit<
  ReviewResultV2,
  "schemaVersion" | "screens"
> {
  schemaVersion: 3;
  screens: readonly ScreenReviewV3[];
  components: readonly ComponentReview[];
  changes: readonly ChangedEntry[];
  affectedConsumers: readonly AffectedConsumer[];
}
