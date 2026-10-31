/**
 * The view controls of a workspace, in one group at the end of the screen
 * header: the viewport select, the Dark preview toggle of a catalogue with
 * dark previews, and the Highlight components toggle. A control behind which
 * a changed view hides carries a change mark. A static depiction that runs no
 * script draws each toggle as a native switch, which acts in place as the
 * native viewport select does.
 */

import type { ComponentProps } from "react";

import { ChangeMark } from "../change-mark/change-mark.js";
import {
  IconButton,
  IconSelect,
  IconSwitch,
  type IconSelectOption,
} from "../icon-control/icon-control.js";
import { WorkspaceIcon } from "../icons/icons.js";

/** The previews' viewport: one viewport, or both at once. */
export type PreviewViewport = "mobile" | "desktop" | "both";

/** The previews' colour scheme. */
export type PreviewScheme = "light" | "dark";

/**
 * The change mark of a view control: the id and the text of its wording, and
 * whether a changed view hides behind the control.
 */
export interface ViewMark {
  id: string;
  marked: boolean;
  text: string;
}

/** The state of the Highlight components toggle. */
export interface ViewHighlight {
  /** Whether highlighting is on, which presses the toggle. */
  active: boolean;
  /** Whether the shown preview can be highlighted. Otherwise the toggle is disabled. */
  available: boolean;
  /** Why highlighting is unavailable, which describes and titles the toggle. */
  reason?: string | undefined;
}

const VIEWPORTS: readonly IconSelectOption<PreviewViewport>[] = [
  ["mobile", "Mobile"],
  ["desktop", "Desktop"],
  ["both", "Both"],
];

export function ViewControls({
  darkPreview,
  highlight,
  interactive = true,
  onHighlight,
  onScheme,
  onViewport,
  viewport,
  viewportMark,
}: {
  /**
   * The Dark preview toggle of a catalogue with dark previews: the previews'
   * scheme, which presses the toggle in Dark, and the toggle's change mark.
   * Without it, the group has no such toggle.
   */
  darkPreview?: { mark: ViewMark; scheme: PreviewScheme } | undefined;
  /** The Highlight components toggle. Without it, the toggle is disabled. */
  highlight?: ViewHighlight | undefined;
  /**
   * Whether each toggle is a button that reports its presses, as it is by
   * default. A static depiction that runs no script sets `false`, which draws
   * each toggle as a native switch that starts in the given state.
   */
  interactive?: boolean;
  /** Receives each press of Highlight components. */
  onHighlight?: (() => void) | undefined;
  /** Receives the scheme that the Dark preview toggle asks for. */
  onScheme?: ((scheme: PreviewScheme) => void) | undefined;
  /** Receives each viewport that the reader chooses. */
  onViewport?: ((viewport: PreviewViewport) => void) | undefined;
  /** The viewport that the select shows. */
  viewport: PreviewViewport;
  /** The change mark of the viewport select. */
  viewportMark: ViewMark;
}) {
  return (
    <div className="mbk-view-tools" role="group" aria-label="View options">
      <IconSelect
        describedBy={viewportMark.marked ? viewportMark.id : undefined}
        glyph={<WorkspaceIcon name="viewport" />}
        label="Viewport"
        mark="data-workspace-viewport"
        onChange={onViewport}
        options={VIEWPORTS}
        title="Viewport"
        value={viewport}
      >
        <ChangeMark
          id={viewportMark.id}
          kind="viewport"
          marked={viewportMark.marked}
          text={viewportMark.text}
        />
      </IconSelect>
      {darkPreview ? (
        <Toggle
          describedBy={
            darkPreview.mark.marked ? darkPreview.mark.id : undefined
          }
          interactive={interactive}
          label="Dark preview"
          mark="data-workspace-scheme"
          onClick={() =>
            onScheme?.(darkPreview.scheme === "dark" ? "light" : "dark")
          }
          pressed={darkPreview.scheme === "dark"}
          title="Dark preview"
        >
          <WorkspaceIcon name="scheme" />
          <ChangeMark
            id={darkPreview.mark.id}
            kind="scheme"
            marked={darkPreview.mark.marked}
            text={darkPreview.mark.text}
          />
        </Toggle>
      ) : null}
      <Toggle
        description={
          highlight?.reason ??
          "Inspect component regions and their supplied props."
        }
        disabled={!highlight?.available}
        interactive={interactive}
        label="Highlight components"
        mark="data-workspace-highlight"
        onClick={onHighlight}
        pressed={highlight?.active ?? false}
        title={highlight?.reason ?? "Highlight components"}
      >
        <WorkspaceIcon name="highlight" />
      </Toggle>
    </div>
  );
}

/**
 * One toggle of the group: a button that reports its presses, or the native
 * switch of a static depiction, which starts at the pressed state.
 */
function Toggle({
  interactive,
  onClick,
  pressed,
  ...control
}: Omit<ComponentProps<typeof IconButton>, "pressed"> & {
  interactive: boolean;
  pressed: boolean;
}) {
  if (interactive)
    return <IconButton {...control} onClick={onClick} pressed={pressed} />;
  return <IconSwitch {...control} checked={pressed} />;
}
