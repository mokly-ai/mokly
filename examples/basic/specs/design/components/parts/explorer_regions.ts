import type { PreviewRegions, ViewRegions } from "../../parts/depicted_view.js";

import { INSPECTION_PAGES } from "./destinations.js";
import { toolbarAction, welcomeInstances } from "./fixtures.js";

/** The regions of a preview whose fixed layout is the same in both viewports. */
function inBoth(regions: PreviewRegions): ViewRegions {
  return { desktop: regions, mobile: regions };
}

/** The shell's label of a depicted instance: its component and its id. */
function labelOf(instance: { component: string; label: string }): string {
  return `${instance.component} · ${instance.label}`;
}

const [main, nested, footer] = welcomeInstances;

/**
 * Welcome's own instances in the explorer's consumer example, whose fixed
 * layout draws the Toolbar 24px from both sides and 76px down, and the Footer
 * action 258px down. Each label opens the artboard of a selection.
 */
export const WELCOME_REGIONS = inBoth([
  {
    box: { x: 24, y: 76, width: "calc(100% - 48px)", height: 82 },
    label: labelOf(main),
    to: INSPECTION_PAGES.nested,
  },
  {
    box: { x: 24, y: 258, width: 116, height: 36 },
    label: labelOf(footer),
    to: INSPECTION_PAGES.details,
  },
]);

/** The selected Toolbar action, 41px from the right edge of the Toolbar. */
export const NESTED_REGIONS = inBoth([
  {
    box: { x: "calc(100% - 145px)", y: 99, width: 104, height: 36 },
    label: labelOf(nested),
    to: INSPECTION_PAGES.nested,
  },
]);

/**
 * Details' single Action, below its heading and its text, which takes two
 * lines in a phone.
 */
export const CONSUMER_REGIONS = {
  desktop: [
    {
      box: { x: 24, y: 102.5, width: 104, height: 36 },
      label: "Action · Continue",
      to: INSPECTION_PAGES.consumer,
    },
  ],
  mobile: [
    {
      box: { x: 24, y: 122, width: 104, height: 36 },
      label: "Action · Continue",
      to: INSPECTION_PAGES.consumer,
    },
  ],
} as const satisfies ViewRegions;

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
