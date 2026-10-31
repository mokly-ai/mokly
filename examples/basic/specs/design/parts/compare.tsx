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
  component = false,
  path,
}: {
  children: ReactNode;
  /** Whether the compared entry is a component, which the stage marks. */
  component?: boolean;
  /** The compared entry's path, which the comparison carries. */
  path: string;
}) {
  return (
    <ComparisonStageView
      component={component}
      current={false}
      entryId={path}
      stage={children}
    />
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

/** One version's pane, which names its side as the shell does. */
export function Pane({
  children,
  side,
}: {
  children: ReactNode;
  side: "after" | "before";
}) {
  return (
    <comparisonPane.Component
      moklyInstance={useDesignInstance(side)}
      side={side}
      state="present"
    >
      {children}
    </comparisonPane.Component>
  );
}

/** The pane of a version that has no document, with the message saying why. */
export function MissingPane({
  message,
  side,
}: {
  message: string;
  side: "after" | "before";
}) {
  return (
    <comparisonPane.Component
      moklyInstance={useDesignInstance(side)}
      side={side}
      state="missing"
      message={message}
    />
  );
}
