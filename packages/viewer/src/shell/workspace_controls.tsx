/** Grouped, compact viewport, theme and inspection controls. */
import { useShellIdentifier } from "./identifier_context.js";
import { useOptionalShellStore } from "./store_context.js";
import {
  VIEW_CHANGED_CLASS,
  VIEW_CHANGED_IDS,
  VIEW_CHANGED_TEXT,
  VIEW_CHANGED_TEXT_CLASS,
  viewMarks,
  type ChangedView,
} from "./view_marks.js";
import { WorkspaceIcon } from "./workspace_icons.js";

function ViewChangedMark({
  id,
  kind,
  marked,
}: {
  id: string;
  kind: "scheme" | "viewport";
  marked: boolean;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={VIEW_CHANGED_CLASS}
        data-view-changed={kind}
        hidden={!marked}
      />
      <span
        className={VIEW_CHANGED_TEXT_CLASS}
        data-view-changed-text={kind}
        hidden={!marked}
        id={id}
      >
        {VIEW_CHANGED_TEXT[kind]}
      </span>
    </>
  );
}

export function WorkspaceControls({
  changedViews,
  dark,
  displayedScheme,
  highlight,
}: {
  changedViews: readonly ChangedView[];
  dark: boolean;
  displayedScheme: "dark" | "light";
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
  const marks = viewMarks(changedViews, viewport, displayedScheme);
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
        <ViewChangedMark
          id={viewportChangedId}
          kind="viewport"
          marked={marks.viewport}
        />
      </label>
      {dark ? (
        <button
          type="button"
          className="mbk-icon-button"
          aria-label="Dark mode"
          aria-describedby={marks.scheme ? schemeChangedId : undefined}
          aria-pressed={scheme === "dark"}
          title="Dark mode"
          data-workspace-scheme=""
          onClick={() =>
            store?.selectColorScheme(
              store.state.selection.colorScheme === "dark" ? "light" : "dark",
            )
          }
        >
          <WorkspaceIcon name="scheme" />
          <ViewChangedMark
            id={schemeChangedId}
            kind="scheme"
            marked={marks.scheme}
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
