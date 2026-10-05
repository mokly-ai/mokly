import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../../metadata.js";
import { ComponentPage } from "../../parts/component_page.js";

export function RemovedParentDesktop() {
  return <ComponentPage state="removed-parent" viewport="desktop" />;
}

export function RemovedParentMobile() {
  return <ComponentPage state="removed-parent" viewport="mobile" />;
}

export const movedVariantDesigns = [
  defineScreen({
    ...componentDesignMetadata,
    slug: "removed-parent",
    title: "Removed component with moved variants",
    colorSchemes: ["light"],
    description:
      "The removed top-level Link button lists its two variants at their new places in Action and Toolbar, with no variant bar, comparison band or Location row.",
    rationale:
      "Each moved variant keeps its own history at its new place, so the page sends the reader there instead of offering a comparison it cannot show.",
    desktop: <RemovedParentDesktop />,
    mobile: <RemovedParentMobile />,
  }),
];
