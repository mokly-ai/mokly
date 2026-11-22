import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../metadata.js";
import { artboards } from "../../parts/artboards.js";
import { ComponentPage } from "../parts/component_page.js";
import { ScreenPage } from "../parts/screen_page.js";

function RemovedVariantDesktop() {
  return <ComponentPage viewport="desktop" />;
}
function RemovedVariantMobile() {
  return <ComponentPage viewport="mobile" />;
}
function RemovedConsumerDesktop() {
  return <ScreenPage viewport="desktop" />;
}
function RemovedConsumerMobile() {
  return <ScreenPage viewport="mobile" />;
}

/*
 * A removed saved variant and the removed screen that consumed it. They stay
 * until decision 34 settles how the Canvas family shows a removed entry's
 * previous version: the removed consumer opens its previous version from the
 * removed variant's affected list.
 */
export const removedScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "removed",
  title: "Removed variant and former consumer",
  colorSchemes: ["light"],
  description:
    "The removed Compact variant retains its Before canvas and links a removed affected screen to its previous version.",
  ...artboards({
    desktop: <RemovedVariantDesktop />,
    mobile: <RemovedVariantMobile />,
  }),
});
export const removedConsumerScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "removed-consumer",
  title: "Retained removed screen",
  colorSchemes: ["light"],
  description:
    "The former Farewell consumer remains reachable from Action's affected list and opens its previous version.",
  ...artboards({
    desktop: <RemovedConsumerDesktop />,
    mobile: <RemovedConsumerMobile />,
  }),
});
