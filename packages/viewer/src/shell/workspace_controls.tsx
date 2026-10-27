/** Grouped, compact viewport, theme and inspection controls. */
import { ChangeMark } from "@mokly/ui/change-mark";
import { WorkspaceIcon } from "@mokly/ui/icons";

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
    <div className="mbk-view-tools" role="group" aria-label="View options">
      <label className="mbk-icon-select" title="Viewport">
        <WorkspaceIcon name="viewport" />
        <WorkspaceIcon name="caret" />
        <select
          aria-describedby={marks.viewport ? viewportChangedId : undefined}
          aria-label="Viewport"
          data-workspace-viewport=""
          onChange={(event) =>
            store?.selectViewport(
              event.currentTarget.value as "mobile" | "desktop" | "both",
            )
          }
          value={viewport}
        >
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="both">Both</option>
        </select>
        <ChangeMark
          id={viewportChangedId}
          kind="viewport"
          marked={marks.viewport}
          text={VIEW_CHANGED_TEXT.viewport}
        />
      </label>
      {dark ? (
        <button
          type="button"
          className="mbk-icon-button"
          aria-label="Dark preview"
          aria-describedby={marks.scheme ? schemeChangedId : undefined}
          aria-pressed={scheme === "dark"}
          title="Dark preview"
          data-workspace-scheme=""
          onClick={() =>
            store?.selectColorScheme(
              store.state.selection.colorScheme === "dark" ? "light" : "dark",
            )
          }
        >
          <WorkspaceIcon name="scheme" />
          <ChangeMark
            id={schemeChangedId}
            kind="scheme"
            marked={marks.scheme}
            text={VIEW_CHANGED_TEXT.scheme}
          />
        </button>
      ) : null}
      <button
        type="button"
        className="mbk-icon-button"
        aria-label="Highlight components"
        aria-description={
          highlight?.reason ??
          "Inspect component regions and their supplied props."
        }
        aria-pressed={highlight?.active ?? false}
        title={highlight?.reason ?? "Highlight components"}
        data-workspace-highlight=""
        disabled={!highlight?.available}
        onClick={highlight?.toggle}
      >
        <WorkspaceIcon name="highlight" />
      </button>
    </div>
  );
}
