import type { ComponentWireProps } from "../components/prop_types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

import type {
  DependencyReason,
  ReviewState,
  ScreenReview,
  ViewReview,
} from "./types.js";

export interface ReviewEntryAddress<Path extends string = string> {
  path: Path;
  title: string;
}
export interface ReviewEntrySides<
  Current extends string = string,
  Before extends string = string,
> {
  before?: ReviewEntryAddress<Before>;
  after?: ReviewEntryAddress<Current>;
  previousPath?: Before;
}
export interface ScreenReviewV5<
  Current extends string = string,
  Before extends string = string,
>
  extends ScreenReview<Current>, ReviewEntrySides<Current, Before> {}
export interface ReviewVariantAddress<Path extends string = string> {
  path: Path;
  title: string;
  description?: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
}
export interface ComponentVariantReview<
  Current extends string = string,
  Before extends string = string,
> {
  path: Current;
  previousPath?: Before;
  title: string;
  before?: ReviewVariantAddress<Before>;
  after?: ReviewVariantAddress<Current>;
  state: ReviewState;
  views: readonly ViewReview[];
}
export interface ComponentReview<
  Current extends string = string,
  Before extends string = string,
>
  extends
    Omit<ScreenReview<Current>, "views">,
    ReviewEntrySides<Current, Before> {
  variants: readonly ComponentVariantReview<Current, Before>[];
}
export type EntryChangeReason =
  | {
      kind:
        "added" | "removed" | "metadata" | "material" | "inputs" | "structure";
    }
  | DependencyReason
  | { kind: "screen"; screenPath: string };
export interface ChangedEntry<
  Current extends string = string,
  Before extends string = string,
> extends ReviewEntrySides<Current, Before> {
  kind: "screen" | "component" | "use-case";
  reasons: readonly EntryChangeReason[];
}
export type ComponentUsageContext<Path extends string = string> =
  | {
      kind: "screen";
      entry: ReviewEntryAddress<Path>;
      viewport: Viewport;
      colorScheme: ColorScheme;
    }
  | {
      kind: "component";
      entry: ReviewEntryAddress<Path>;
      variantPath: Path;
      viewport: Viewport;
      colorScheme: ColorScheme;
    };
export type AffectedUsageEvidence<
  Current extends string = string,
  Before extends string = string,
> =
  | {
      side: "before";
      context: ComponentUsageContext<Before>;
      via: readonly { componentId: Before; instanceKey: string }[];
    }
  | {
      side: "after";
      context: ComponentUsageContext<Current>;
      via: readonly { componentId: Current; instanceKey: string }[];
    };
export interface AffectedConsumer<
  Current extends string = string,
  Before extends string = string,
> {
  changedComponentId: Current;
  consumer:
    { kind: "screen"; path: Current } | { kind: "component"; path: Current };
  evidence: readonly AffectedUsageEvidence<Current, Before>[];
}
export interface ReviewResultV5<
  Current extends string = string,
  Before extends string = string,
> {
  baseCommit: string;
  baseRef: string;
  changedPaths: readonly string[];
  ignoredImpact: readonly {
    colorScheme: ColorScheme;
    count: number;
    id: string;
    viewport: Viewport;
  }[];
  screens: readonly ScreenReviewV5<Current, Before>[];
  schemaVersion: 5;
  sharedImpact: readonly string[];
  components: readonly ComponentReview<Current, Before>[];
  changes: readonly ChangedEntry<Current, Before>[];
  affectedConsumers: readonly AffectedConsumer<Current, Before>[];
}
