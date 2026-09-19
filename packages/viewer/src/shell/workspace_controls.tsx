/** Grouped, compact viewport, theme and inspection controls. */
import { useOptionalShellStore } from "./store_context.js";
import { WorkspaceIcon } from "./workspace_icons.js";

export function WorkspaceControls({
  dark,
  highlight,
}: {
  dark: boolean;
  highlight?: {
    available: boolean;
    active: boolean;
    reason?: string;
    toggle(): void;
  };
}) {
  const store = useOptionalShellStore();
  return (
    <div className="mbk-view-tools" role="group" aria-label="View options">
      <label className="mbk-icon-select" title="Viewport">
        <WorkspaceIcon name="viewport" />
        <WorkspaceIcon name="caret" />
        <select
          aria-label="Viewport"
          data-workspace-viewport=""
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
      </label>
      {dark ? (
        <button
          type="button"
          className="mbk-icon-button"
          aria-label="Dark mode"
          aria-pressed={store?.state.selection.colorScheme === "dark"}
          title="Dark mode"
          data-workspace-scheme=""
          onClick={() =>
            store?.selectColorScheme(
              store.state.selection.colorScheme === "dark" ? "light" : "dark",
            )
          }
        >
          <WorkspaceIcon name="scheme" />
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
