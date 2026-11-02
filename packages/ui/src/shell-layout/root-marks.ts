/**
 * The marks of a viewer root's state, which the stylesheets select on the
 * root: a separator that the reader drags, and a browser window that is
 * expanded over the shell. The standalone and the embedded root share them.
 */

/** The separator that the reader drags: the inspector's or the navigation's. */
export type ShellResizing = "inspector" | "navigation";

/** The state of a viewer root that its class list marks. */
export interface RootMarks {
  /** Whether a browser window is expanded over the shell. */
  frameExpanded?: boolean | undefined;
  /** The separator that the reader drags. */
  resizing?: ShellResizing | undefined;
}

/** The class of each drag, which the stylesheet of its separator selects. */
const RESIZING_CLASS = {
  inspector: "mbk-inspector-resizing",
  navigation: "mbk-nav-resizing",
} as const satisfies Record<ShellResizing, string>;

/**
 * The class list of a viewer root: its own classes, the marks of its state,
 * then the reset class.
 */
export function rootClassName(
  classes: string,
  { frameExpanded, resizing }: RootMarks,
): string {
  return [
    classes,
    resizing === undefined ? undefined : RESIZING_CLASS[resizing],
    frameExpanded ? "frame-expanded" : undefined,
    "mbk-reset",
  ]
    .filter((name): name is string => name !== undefined)
    .join(" ");
}
