/** Grouped, compact viewport, theme and inspection controls. */
import { WorkspaceIcon } from "./workspace_icons.js";

export function WorkspaceControls({ dark }: { dark: boolean }) {
  return (
    <div className="mbk-view-tools" role="group" aria-label="View options">
      <label className="mbk-icon-select" title="Viewport">
        <WorkspaceIcon name="viewport" />
        <WorkspaceIcon name="caret" />
        <select
          aria-label="Viewport"
          data-workspace-viewport=""
          defaultValue="both"
        >
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="both">Both</option>
        </select>
      </label>
      {dark ? (
        <button
          type="button"
          className="mbk-icon-button"
          aria-label="Dark mode"
          aria-pressed="false"
          title="Dark mode"
          data-workspace-scheme=""
        >
          <WorkspaceIcon name="scheme" />
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
