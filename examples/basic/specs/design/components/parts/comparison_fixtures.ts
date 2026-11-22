import type { ChangeReasonKind } from "../../parts/reason_sentences.js";
import type { StylesheetEvidence } from "../../parts/stylesheet_evidence.js";

import type { ComponentPageState } from "./component_details.js";
import type { ComponentDesignDestination } from "./destinations.js";
import type { ScreenPageState } from "./screen_preview.js";

export type ChangeStatus = "unmodified" | "added" | "changed" | "removed";

interface ChangedComparisonFixture {
  status: Exclude<ChangeStatus, "unmodified">;
  /**
   * The routed entry's direct reasons in their sorted order. Details read
   * each one as its sentence, and a `dependency` only through the files list.
   */
  reasons: readonly ChangeReasonKind[];
  variant?: string;
  savedPropsUnchanged?: boolean;
  /** A changed supplied prop: its instance's component and id, and its values. */
  propChange?: {
    title: string;
    instanceId: string;
    prop: string;
    before: string;
    after: string;
  };
  /** Changed stylesheets, each with the evidence it retained for this entry. */
  stylesheets?: readonly StylesheetEvidence[];
  changedComponents?: readonly {
    title: string;
    to: ComponentDesignDestination;
  }[];
}

interface ExcludedStylesFixture {
  status: "unmodified";
  excludedStylesheets: readonly string[];
}

/**
 * An entry that changed components affect, with no Changes row of its own: it
 * has no reasons, its views stay unchanged, and they keep the component-owned
 * style records that Details read as files.
 */
interface AffectedFixture {
  status: "unmodified";
  affected: true;
  stylesheets: readonly StylesheetEvidence[];
  changedComponents: readonly {
    title: string;
    to: ComponentDesignDestination;
  }[];
}

export type ComparisonFixture =
  ChangedComparisonFixture | ExcludedStylesFixture | AffectedFixture;

/** Paired synthetic values also supply the current screen and its Props panel. */
export const footerLabelChange = {
  title: "Action",
  instanceId: "Footer action",
  prop: "label",
  before: "Continue",
  after: "Get started",
} as const;

/**
 * These are authored comparison records, not analysis of rendered pixels:
 * the removed saved variant, and the removed screen that consumed it.
 */
const componentComparisons: Partial<
  Record<ComponentPageState, ComparisonFixture>
> = {
  removed: { status: "changed", reasons: ["removed"], variant: "Compact" },
};

const screenComparisons: Partial<
  Record<ScreenPageState, ChangedComparisonFixture | AffectedFixture>
> = {
  "removed-consumer": { status: "removed", reasons: ["removed"] },
};

export function componentComparison(state: ComponentPageState) {
  return componentComparisons[state];
}

export function screenComparison(state: ScreenPageState) {
  return screenComparisons[state];
}
