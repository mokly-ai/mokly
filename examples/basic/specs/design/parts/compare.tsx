import type { ReactNode } from "react";

import {
  ComparisonPanes,
  ComparisonStage as ComparisonStageView,
} from "../../../../../packages/ui/src/comparison-stage/comparison-stage.js";
import { useDesignInstance } from "../library/composition.js";
import { comparisonToolbar } from "../library/controls/comparison-toolbar.js";
import { comparisonPane } from "../library/preview/comparison-pane.js";

import { useDesignNavigation } from "./design_navigation.js";
import type { ComparisonMode } from "./destinations.js";

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
