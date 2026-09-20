/** Grouped, compact viewport, theme and inspection controls. */
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
  kind,
  marked,
}: {
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
        id={VIEW_CHANGED_IDS[kind]}
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
}: {
  changedViews: readonly ChangedView[];
  dark: boolean;
}) {
  const marks = viewMarks(changedViews, "both", "light");
  return (
    <div className="mbk-view-tools" role="group" aria-label="View options">
      <label className="mbk-icon-select" title="Viewport">
        <WorkspaceIcon name="viewport" />
        <WorkspaceIcon name="caret" />
        <select
          aria-label="Viewport"
          data-workspace-viewport=""
          {...(marks.viewport
            ? { "aria-describedby": VIEW_CHANGED_IDS.viewport }
            : {})}
          defaultValue="both"
        >
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="both">Both</option>
        </select>
        <ViewChangedMark kind="viewport" marked={marks.viewport} />
      </label>
      {dark ? (
        <button
          type="button"
          className="mbk-icon-button"
          aria-label="Dark mode"
          aria-pressed="false"
          title="Dark mode"
          data-workspace-scheme=""
          {...(marks.scheme
            ? { "aria-describedby": VIEW_CHANGED_IDS.scheme }
            : {})}
        >
          <WorkspaceIcon name="scheme" />
          <ViewChangedMark kind="scheme" marked={marks.scheme} />
        </button>
      ) : null}
      <button
        type="button"
        className="mbk-icon-button"
        aria-label="Highlight components"
        aria-pressed="false"
        title="Highlight components"
        data-workspace-highlight=""
        disabled
      >
        <WorkspaceIcon name="highlight" />
      </button>
    </div>
  );
}
