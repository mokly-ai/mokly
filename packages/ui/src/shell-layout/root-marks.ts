/**
 * The marks of a viewer root's state, which the stylesheets select on the
 * root: a separator that the reader drags, and the Canvas layout with the
 * catalogue's width. The standalone and the embedded root share them.
 */

import type { CSSProperties } from "react";

/**
 * The attributes of a root in the Canvas layout: `data-canvas-layout`, and
 * the catalogue's chosen width as `--mbk-nav-width`, which the floating
 * catalogue and the canvas's start inset read.
 */
export function canvasLayoutMarks(
  canvas: boolean,
  navigationWidth: number | undefined,
): { "data-canvas-layout"?: string; style?: CSSProperties } {
  if (!canvas) return {};
  return {
    "data-canvas-layout": "",
    ...(navigationWidth === undefined
      ? {}
      : {
          style: {
            "--mbk-nav-width": `${Math.round(navigationWidth)}px`,
          } as CSSProperties,
        }),
  };
}

/** The separator that the reader drags: the navigation's. */
export type ShellResizing = "navigation";

/** The state of a viewer root that its class list marks. */
export interface RootMarks {
  /** The separator that the reader drags. */
  resizing?: ShellResizing | undefined;
}

/** The class of each drag, which the stylesheet of its separator selects. */
const RESIZING_CLASS = {
  navigation: "mbk-nav-resizing",
} as const satisfies Record<ShellResizing, string>;

/**
 * The class list of a viewer root: its own classes, the marks of its state,
 * then the reset class.
 */
export function rootClassName(
  classes: string,
  { resizing }: RootMarks,
): string {
  return [
    classes,
    resizing === undefined ? undefined : RESIZING_CLASS[resizing],
    "mbk-reset",
  ]
    .filter((name): name is string => name !== undefined)
    .join(" ");
}
