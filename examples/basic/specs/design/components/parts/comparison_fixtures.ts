import type { ChangeReasonKind } from "../../parts/reason_sentences.js";
import {
  COMPONENT_STYLE_COPY,
  SCREEN_STYLE_COPY,
  type StylesheetEvidence,
} from "../../parts/stylesheet_evidence.js";

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
  propChange?: {
    instance: string;
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

export type ComparisonFixture =
  ChangedComparisonFixture | ExcludedStylesFixture;

/** Paired synthetic values also supply the current screen and its Props panel. */
export const footerLabelChange = {
  instance: "Action · Footer action",
  prop: "label",
  before: "Continue",
  after: "Get started",
} as const;

export const actionComparison = {
  status: "changed",
  reasons: ["material"],
  variant: "Default",
  savedPropsUnchanged: true,
} as const satisfies ComparisonFixture;

/** The Checklist's own output changed while its saved props stayed the same. */
const checklistComparison = {
  status: "changed",
  reasons: ["material"],
  variant: "Default",
  savedPropsUnchanged: true,
} as const satisfies ComparisonFixture;

/** The one stylesheet all three stylesheet stories change. */
const ACTION_STYLES = "styles/actions.css";

/**
 * Its changed `.action` rule styles only Action's own output. A markup change
 * shows only where Welcome and Details use Action, so the parent also has the
 * `implementation` reason, which leaves the Default caption naming the styles.
 */
const actionStyleComparison = {
  status: "changed",
  reasons: ["dependency", "implementation"],
  variant: "Default",
  savedPropsUnchanged: true,
  stylesheets: [
    {
      path: ACTION_STYLES,
      outcomes: [
        { lead: COMPONENT_STYLE_COPY.matched, selectors: [".action"] },
      ],
    },
  ],
} as const satisfies ComparisonFixture;

/** These are authored comparison records, not analysis of rendered pixels. */
const componentComparisons: Partial<
  Record<ComponentPageState, ComparisonFixture>
> = {
  comparison: actionComparison,
  overlay: actionComparison,
  difference: actionComparison,
  "overlay-tall": checklistComparison,
  affected: actionComparison,
  added: { status: "added", reasons: ["added"], variant: "Default" },
  removed: { status: "changed", reasons: ["removed"], variant: "Compact" },
  "shared-impact": {
    status: "unmodified",
    excludedStylesheets: [ACTION_STYLES],
  },
  "style-changed": actionStyleComparison,
};

const screenComparisons: Partial<
  Record<ScreenPageState, ChangedComparisonFixture>
> = {
  /** A caller-owned prop changes the instance's props digest, so it is material. */
  "direct-change": {
    status: "changed",
    reasons: ["inputs", "material"],
    propChange: footerLabelChange,
    changedComponents: [
      { title: "Action", to: "design/components/pages/affected" },
    ],
  },
  "removed-consumer": { status: "removed", reasons: ["removed"] },
  "style-outside": {
    status: "changed",
    reasons: ["dependency"],
    stylesheets: [
      {
        path: ACTION_STYLES,
        outcomes: [{ lead: SCREEN_STYLE_COPY.outside, selectors: [".action"] }],
      },
    ],
    changedComponents: [
      {
        title: "Action",
        to: "design/components/states/shared-impact/style-changed",
      },
    ],
  },
};

export function componentComparison(state: ComponentPageState) {
  return componentComparisons[state];
}

export function screenComparison(state: ScreenPageState) {
  return screenComparisons[state];
}
