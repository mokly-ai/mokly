import type { ReactNode } from "react";

import { useDesignInstance } from "../library/composition.js";
import { comparisonToolbar } from "../library/controls/comparison-toolbar.js";
import { comparisonPane } from "../library/preview/comparison-pane.js";

import { useDesignNavigation } from "./design_navigation.js";
import type { ComparisonMode } from "./destinations.js";
import type { ReviewState } from "./review.js";

export function CompareToolbar({
  mode,
  accessible = false,
}: {
  mode: ComparisonMode;
  accessible?: boolean | undefined;
}) {
  const navigation = useDesignNavigation();
  return (
    <comparisonToolbar.Component
      moklyInstance={useDesignInstance("comparison")}
      mode={mode}
      eligible
      accessible={accessible}
      destinations={navigation.comparison ?? {}}
    />
  );
}

const STATE_LABELS: Record<ReviewState, string> = {
  added: "New screen",
  changed: "Screen changed",
  removed: "Screen removed",
  "styles-changed": "Styles this screen uses changed",
};

/** The scrollable stage of a loaded comparison, headed by its outcome. */
export function ComparisonStage({
  children,
  state,
  viewport,
}: {
  children: ReactNode;
  state: ReviewState;
  viewport: "mobile" | "desktop";
}) {
  return (
    <section className="mbk-comparison-stage">
      <h3>
        {viewport === "mobile" ? "Mobile" : "Desktop"} · {STATE_LABELS[state]}
      </h3>
      {children}
    </section>
  );
}

/**
 * Side by side keeps one device chrome per version in a two-column grid on the
 * dotted stage; Overlay and Difference use `ComparisonStack` instead.
 */
export function CompareGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mbk-compare" data-compare-mode="side">
      {children}
    </div>
  );
}

export function Pane({
  children,
  label,
  side,
}: {
  children: ReactNode;
  label: string;
  side: "after" | "before";
}) {
  return (
    <comparisonPane.Component
      moklyInstance={useDesignInstance(side)}
      side={side}
      label={label}
      state="present"
    >
      {children}
    </comparisonPane.Component>
  );
}

export function MissingPane({
  label,
  message,
  side,
}: {
  label: string;
  message: string;
  side: "after" | "before";
}) {
  return (
    <comparisonPane.Component
      moklyInstance={useDesignInstance(side)}
      side={side}
      label={label}
      state="missing"
      message={message}
    />
  );
}
