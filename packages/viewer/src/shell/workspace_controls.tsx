/**
 * The workspace's view controls. This container reads the store and the
 * identifier scope and applies the change-mark rule of `view_marks.ts`, and
 * `@mokly/ui/view-controls` renders the viewport select, the Dark preview
 * toggle, and the Highlight components toggle.
 */
import { ViewControls } from "@mokly/ui/view-controls";

import type { ColorScheme } from "../data/axes.js";

import { useShellIdentifier } from "./identifier_context.js";
import { useOptionalShellStore } from "./store_context.js";
import {
  VIEW_CHANGED_IDS,
  VIEW_CHANGED_TEXT,
  viewMarks,
  type ChangedView,
} from "./view_marks.js";

export function WorkspaceControls({
  changedViews,
  dark,
  effectiveColorScheme,
  highlight,
}: {
  changedViews: readonly ChangedView[];
  dark: boolean;
  effectiveColorScheme: ColorScheme;
  highlight?: {
    available: boolean;
    active: boolean;
    reason?: string;
    toggle(): void;
  };
}) {
  const store = useOptionalShellStore();
  const viewport = store?.state.selection.viewport ?? "both";
  const scheme = store?.state.selection.colorScheme ?? "light";
  const marks = viewMarks(changedViews, viewport, effectiveColorScheme);
  const schemeChangedId = useShellIdentifier(VIEW_CHANGED_IDS.scheme);
  const viewportChangedId = useShellIdentifier(VIEW_CHANGED_IDS.viewport);
  return (
    <ViewControls
      darkPreview={
        dark
          ? {
              mark: {
                id: schemeChangedId,
                marked: marks.scheme,
                text: VIEW_CHANGED_TEXT.scheme,
              },
              scheme,
            }
          : undefined
      }
      highlight={
        highlight
          ? {
              active: highlight.active,
              available: highlight.available,
              reason: highlight.reason,
            }
          : undefined
      }
      onHighlight={highlight?.toggle}
      onScheme={(next) => store?.selectColorScheme(next)}
      onViewport={(next) => store?.selectViewport(next)}
      viewport={viewport}
      viewportMark={{
        id: viewportChangedId,
        marked: marks.viewport,
        text: VIEW_CHANGED_TEXT.viewport,
      }}
    />
  );
}
