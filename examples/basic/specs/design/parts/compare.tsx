import type { ReactNode } from "react";

import {
  ComparisonPanes,
  ComparisonSection,
  ComparisonStage as ComparisonStageView,
} from "../../../../../packages/ui/src/comparison-stage/comparison-stage.js";
import { useDesignInstance } from "../library/composition.js";
import { comparisonToolbar } from "../library/controls/comparison-toolbar.js";
import { comparisonPane } from "../library/preview/comparison-pane.js";

import { useDesignNavigation } from "./design_navigation.js";
import type { ComparisonMode } from "./destinations.js";
import type { ReviewState } from "./review.js";
import { SCREEN_STYLE_COPY } from "./stylesheet_evidence.js";

export function CompareToolbar({
  mode,
  accessible = false,
  scrollTogether = true,
}: {
  mode: ComparisonMode;
  accessible?: boolean | undefined;
  scrollTogether?: boolean | undefined;
}) {
  const navigation = useDesignNavigation();
  return (
    <comparisonToolbar.Component
      moklyInstance={useDesignInstance("comparison")}
      mode={mode}
      eligible
      accessible={accessible}
      scrollTogether={scrollTogether}
      destinations={navigation.comparison ?? {}}
    />
  );
}

const STATE_LABELS: Record<ReviewState, string> = {
  added: "New screen",
  changed: "Screen changed",
  "components-changed": SCREEN_STYLE_COPY.componentsChanged,
  removed: "Screen removed",
  "styles-changed": SCREEN_STYLE_COPY.stylesChanged,
};

/**
 * The shipped stage of a loaded comparison, which scrolls the depicted views
 * on the dotted surface, for the `wrap` of `PreviewWorkspace`. The screen
 * header draws the comparison band, so the stage holds only its sections.
 */
export function ComparisonStage({
  children,
  path,
}: {
  children: ReactNode;
  /** The compared entry's path, which the comparison carries. */
  path: string;
}) {
  return (
    <ComparisonStageView current={false} entryId={path} stage={children} />
  );
}

/** One viewport's shipped section of a comparison, headed by its outcome. */
export function ComparisonView({
  children,
  state,
  viewport,
}: {
  children: ReactNode;
  state: ReviewState;
  viewport: "mobile" | "desktop";
}) {
  return (
    <ComparisonSection label={STATE_LABELS[state]} viewport={viewport}>
      {children}
    </ComparisonSection>
  );
}

/**
 * Side by side keeps one device chrome per version in the shipped grid of
 * panes; Overlay and Difference use `ComparisonStack` instead.
 */
export function CompareGrid({ children }: { children: ReactNode }) {
  return <ComparisonPanes mode="side">{children}</ComparisonPanes>;
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
