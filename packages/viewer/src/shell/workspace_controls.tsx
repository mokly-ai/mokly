/** Grouped, compact viewport, theme and inspection controls. */
import { useShellIdentifierScope } from "./identifier_context.js";
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

/**
 * The accent dot and the wording that names it, both held by every control so
 * a client refresh moves the mark by toggling `hidden` and the control's
 * `aria-describedby` rather than rebuilding the head.
 */
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
        className={VIEW_CHANGED_CLASS}
        aria-hidden="true"
        data-view-changed={kind}
        hidden={!marked}
      />
      <span
        className={VIEW_CHANGED_TEXT_CLASS}
        data-view-changed-text={kind}
        id={id}
        hidden={!marked}
      >
        {VIEW_CHANGED_TEXT[kind]}
      </span>
    </>
  );
}

export function WorkspaceControls({
  changedViews,
  dark,
  highlight,
}: {
  changedViews: readonly ChangedView[];
  dark: boolean;
  highlight?: {
    available: boolean;
    active: boolean;
    reason?: string;
    toggle(): void;
  };
}) {
  const store = useOptionalShellStore();
  const identifier = useShellIdentifierScope();
  const ids = {
    scheme: identifier(VIEW_CHANGED_IDS.scheme),
    viewport: identifier(VIEW_CHANGED_IDS.viewport),
  };
  const marks = viewMarks(
    changedViews,
    store?.state.selection.viewport ?? "both",
    store?.state.selection.colorScheme ?? "light",
  );
  return (
    <div className="mbk-view-tools" role="group" aria-label="View options">
      <label className="mbk-icon-select" title="Viewport">
        <WorkspaceIcon name="viewport" />
        <WorkspaceIcon name="caret" />
        <select
          aria-label="Viewport"
          data-workspace-viewport=""
          {...(marks.viewport ? { "aria-describedby": ids.viewport } : {})}
          onChange={(event) =>
            store?.selectViewport(
              event.currentTarget.value as "mobile" | "desktop" | "both",
            )
          }
          value={store?.state.selection.viewport ?? "both"}
        >
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="both">Both</option>
        </select>
        <ViewChangedMark
          id={ids.viewport}
          kind="viewport"
          marked={marks.viewport}
        />
      </label>
      {dark ? (
        <button
          type="button"
          className="mbk-icon-button"
          aria-label="Dark mode"
          aria-pressed={store?.state.selection.colorScheme === "dark"}
          title="Dark mode"
          data-workspace-scheme=""
          {...(marks.scheme ? { "aria-describedby": ids.scheme } : {})}
          onClick={() =>
            store &&
            store.selectColorScheme(
              store.state.selection.colorScheme === "dark" ? "light" : "dark",
            )
          }
        >
          <WorkspaceIcon name="scheme" />
          <ViewChangedMark
            id={ids.scheme}
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
