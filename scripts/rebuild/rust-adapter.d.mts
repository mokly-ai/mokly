import type { CatalogueReadModel } from "../../packages/viewer/src/generated/catalogue/CatalogueReadModel.js";
import type { EntryChangeReason } from "../../packages/viewer/src/generated/catalogue/EntryChangeReason.js";
import type { EntryDetailV2 } from "../../packages/viewer/src/generated/catalogue/EntryDetailV2.js";
import type { ResourceEvidence } from "../../packages/viewer/src/generated/catalogue/ResourceEvidence.js";
import type { ReviewEntryAddress } from "../../packages/viewer/src/generated/catalogue/ReviewEntryAddress.js";
import type { ReviewState } from "../../packages/viewer/src/generated/catalogue/ReviewState.js";
import type { RuleEvidence } from "../../packages/viewer/src/generated/catalogue/RuleEvidence.js";

import type { BehaviourRecords } from "./behaviour-table.mjs";
import type { LegacyScenario } from "./legacy-adapter.mjs";

/** One view of a captured review v8 entry. */
export interface RustReviewView {
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  state: ReviewState;
  ignoredIds: string[];
  rules?: RuleEvidence[];
  resources?: ResourceEvidence[];
}

/** One entry of a captured review v8 result, with its variants. */
export interface RustReviewEntry {
  kind: "screen" | "component";
  path: string;
  previousPath?: string;
  before?: ReviewEntryAddress;
  after?: ReviewEntryAddress;
  state: ReviewState;
  included: boolean;
  reasons: EntryChangeReason[];
  views: RustReviewView[];
  variants?: RustReviewEntry[];
}

/** One affected consumer of a captured review v8 result. */
export interface RustAffectedConsumer {
  changedComponentId: string;
  consumer: { kind: "screen" | "component"; path: string };
  evidence: {
    side: "before" | "after";
    context: {
      kind: "screen" | "component";
      entry: { path: string };
      viewport: "mobile" | "desktop";
      colorScheme: "light" | "dark";
    };
    via: { componentId: string }[];
  }[];
}

/**
 * A `review.json` captured from the Rust core before comparisons published
 * their facts only through the index and the entry details.
 */
export interface RustReviewCapture {
  schemaVersion: 8;
  entries: RustReviewEntry[];
  affected: RustAffectedConsumer[];
}

export interface RustScenario {
  catalogue?: CatalogueReadModel;
  details?: EntryDetailV2[];
  review?: RustReviewCapture;
  inventory?: LegacyScenario["inventory"];
  closures?: LegacyScenario["closures"];
}
export function adaptRustScenario(scenario: RustScenario): BehaviourRecords;
