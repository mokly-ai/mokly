import type { ProductSituation } from "../product-situation";

export const memberRemovalSituations = [
  {
    path: "product/settings/members/remove",
    family: "settings",
    screen: "members",
    name: "remove",
    states: ["default", "loading"],
    overlay: true,
  },
] as const satisfies readonly ProductSituation[];
