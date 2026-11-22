import type { ViewRegions } from "../../parts/depicted_view.js";

import { toolbarAction } from "./fixtures.js";

/**
 * The Toolbar page's Action, at the end of a Toolbar 560px wide on the
 * desktop canvas and 340px wide on the mobile one. No artboard depicts it
 * selected, so its label is a picture.
 */
export const TOOLBAR_PAGE_REGIONS = {
  desktop: [
    { box: { x: 463, y: 47, width: 104, height: 36 }, label: toolbarAction },
  ],
  mobile: [
    { box: { x: 243, y: 47, width: 104, height: 36 }, label: toolbarAction },
  ],
} as const satisfies ViewRegions;
