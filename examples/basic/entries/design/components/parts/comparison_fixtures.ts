import type { ComponentPageState } from "./component_details.js";
import type { ComponentDesignDestination } from "./destinations.js";
import type { ScreenPageState } from "./screen_preview.js";

export type ChangeStatus = "unmodified" | "added" | "changed" | "removed";

interface ChangedComparisonFixture {
  status: Exclude<ChangeStatus, "unmodified">;
  reason: "output" | "inputs" | "added" | "removed" | "variant-removed";
  variant?: string;
  savedPropsUnchanged?: boolean;
  propChange?: {
    instance: string;
    prop: string;
    before: string;
    after: string;
  };
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
  reason: "output",
  variant: "Default",
  savedPropsUnchanged: true,
} as const satisfies ComparisonFixture;

/** The Checklist's own output changed while its saved props stayed the same. */
const checklistComparison = {
  status: "changed",
  reason: "output",
  variant: "Default",
  savedPropsUnchanged: true,
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
  added: { status: "added", reason: "added", variant: "Default" },
  removed: { status: "changed", reason: "variant-removed", variant: "Compact" },
  "shared-impact": {
    status: "unmodified",
    excludedStylesheets: ["styles/actions.css"],
  },
};

const screenComparisons: Partial<
  Record<ScreenPageState, ChangedComparisonFixture>
> = {
  "direct-change": {
    status: "changed",
    reason: "inputs",
    propChange: footerLabelChange,
    changedComponents: [{ title: "Action", to: "design-component-affected" }],
  },
  "removed-consumer": { status: "removed", reason: "removed" },
};

export function componentComparison(state: ComponentPageState) {
  return componentComparisons[state];
}

export function screenComparison(state: ScreenPageState) {
  return screenComparisons[state];
}
