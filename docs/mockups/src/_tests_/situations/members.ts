import type { ProductSituation } from "../product-situation";

export const memberSituations = [
  {
    path: "product/settings/members/identity",
    family: "settings",
    screen: "members",
    name: "identity",
    states: ["default"],
  },
  // The pane asked for by its address while the settings scope loads. The
  // pane's page already draws four variants, so the wait is a screen beside
  // it, and its controls wait disabled.
  {
    path: "product/settings/members/scope-loading",
    family: "settings",
    screen: "members",
    name: "scope-loading",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  // The pane's three writes on its own controls: Send invitation, Revoke
  // invitation and Save role. The pane's page already draws four variants,
  // so each write is a screen beside it.
  {
    path: "product/settings/members/invitation-sending",
    family: "settings",
    screen: "members",
    name: "invitation-sending",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/members/invitation-revoking",
    family: "settings",
    screen: "members",
    name: "invitation-revoking",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/members/role-saving",
    family: "settings",
    screen: "members",
    name: "role-saving",
    sibling: true,
    states: ["default"],
    pending: true,
  },
] as const satisfies readonly ProductSituation[];
