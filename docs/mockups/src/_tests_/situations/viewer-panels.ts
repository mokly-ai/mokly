import type { ProductSituation } from "../product-situation";

export const viewerPanelSituations = [
  {
    path: "product/viewer/switcher/no-branches",
    family: "viewer",
    screen: "switcher",
    name: "no-branches",
    states: ["default"],
  },
  {
    path: "product/viewer/share/catalogue",
    family: "viewer",
    screen: "share",
    name: "catalogue",
    states: ["default"],
  },
] as const satisfies readonly ProductSituation[];
