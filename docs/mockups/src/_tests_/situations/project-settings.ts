import { productStates } from "../product-families";
import type { ProductSituation } from "../product-situation";

export const projectSettingsSituations = [
  {
    path: "product/settings/project/visibility",
    family: "settings",
    screen: "project",
    name: "visibility",
    states: ["default"],
    pending: true,
    overlay: true,
  },
  {
    path: "product/settings/tokens/create",
    family: "settings",
    screen: "tokens",
    name: "create",
    states: ["default", "loading", "error"],
    overlay: true,
  },
  {
    path: "product/settings/tokens/create/reveal",
    family: "settings",
    screen: "tokens",
    name: "reveal",
    parent: "product/settings/tokens/create",
    states: ["default"],
    overlay: true,
  },
  {
    path: "product/settings/project/visibility/plan",
    family: "settings",
    screen: "project",
    name: "plan",
    parent: "product/settings/project/visibility",
    states: ["default"],
    overlay: true,
  },
  {
    path: "product/settings/project/visibility/plan-admin",
    family: "settings",
    screen: "project",
    name: "plan-admin",
    parent: "product/settings/project/visibility",
    states: ["default"],
    overlay: true,
  },
  // The visibility write in flight for a public project made private.
  {
    path: "product/settings/project/visibility/private",
    family: "settings",
    screen: "project",
    name: "private",
    parent: "product/settings/project/visibility",
    states: ["default"],
    pending: true,
    overlay: true,
  },
  {
    path: "product/settings/project/slug",
    family: "settings",
    screen: "project",
    name: "slug",
    states: productStates,
  },
  {
    path: "product/settings/project/slug/conflict",
    family: "settings",
    screen: "project",
    name: "conflict",
    parent: "product/settings/project/slug",
    states: ["default"],
  },
  {
    path: "product/settings/project/no-builds",
    family: "settings",
    screen: "project",
    name: "no-builds",
    states: ["default"],
  },
  // The Automatic builds switch's own write. The pane's page already draws
  // its four variants, so the write is a screen beside it.
  {
    path: "product/settings/project/builds-saving",
    family: "settings",
    screen: "project",
    name: "builds-saving",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  // The pane asked for by its address while the settings scope loads. The
  // pane's page already draws its four variants, so the wait is a screen
  // beside it, and its controls wait as placeholders.
  {
    path: "product/settings/project/scope-loading",
    family: "settings",
    screen: "project",
    name: "scope-loading",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/tokens/create/copy",
    family: "settings",
    screen: "tokens",
    name: "copy",
    parent: "product/settings/tokens/create",
    states: ["default"],
    overlay: true,
  },
  {
    path: "product/settings/tokens/revoke",
    family: "settings",
    screen: "tokens",
    name: "revoke",
    states: ["default", "loading"],
    overlay: true,
  },
  {
    path: "product/settings/tokens/revoke/menu",
    family: "settings",
    screen: "tokens",
    name: "menu",
    parent: "product/settings/tokens/revoke",
    states: ["default"],
    overlay: true,
  },
  // The Delete project pane asked for by its address while the settings
  // scope loads: the pane's fifth drawing, beside its four states.
  {
    path: "product/settings/danger/scope-loading",
    family: "settings",
    screen: "danger",
    name: "scope-loading",
    states: ["default"],
    pending: true,
  },
] as const satisfies readonly ProductSituation[];
