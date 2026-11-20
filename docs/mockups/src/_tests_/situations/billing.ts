import type { ProductSituation } from "../product-situation";

export const billingSituations = [
  {
    path: "product/settings/billing/confirming",
    family: "settings",
    screen: "billing",
    name: "confirming",
    states: ["default"],
  },
  {
    path: "product/settings/billing/delayed",
    family: "settings",
    screen: "billing",
    name: "delayed",
    states: ["default"],
  },
  // Check again's write, a state of the delayed confirmation it belongs to.
  {
    path: "product/settings/billing/delayed/checking",
    family: "settings",
    screen: "billing",
    name: "checking",
    parent: "product/settings/billing/delayed",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/billing/trial",
    family: "settings",
    screen: "billing",
    name: "trial",
    states: ["default"],
  },
  {
    path: "product/settings/billing/past-due",
    family: "settings",
    screen: "billing",
    name: "past-due",
    states: ["default"],
  },
  {
    path: "product/settings/billing/ending",
    family: "settings",
    screen: "billing",
    name: "ending",
    states: ["default"],
  },
  {
    path: "product/settings/billing/admin",
    family: "settings",
    screen: "billing",
    name: "admin",
    states: ["default"],
  },
  {
    path: "product/settings/billing/admin-free",
    family: "settings",
    screen: "billing",
    name: "admin-free",
    states: ["default"],
  },
  {
    path: "product/settings/billing/unavailable",
    family: "settings",
    screen: "billing",
    name: "unavailable",
    states: ["default"],
  },
  {
    path: "product/settings/billing/unpriced",
    family: "settings",
    screen: "billing",
    name: "unpriced",
    states: ["default"],
  },
  // The Billing pane asked for by its address while the session and the
  // settings scope load, as Stripe returns to it, and its durable route on a
  // wide surface until it hands over to the dialog: the same wait, with each
  // pane that the route has no address for disabled in the rail.
  {
    path: "product/settings/billing/scope-loading",
    family: "settings",
    screen: "billing",
    name: "scope-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/billing/route-loading",
    family: "settings",
    screen: "billing",
    name: "route-loading",
    states: ["default"],
    pending: true,
  },
  // Upgrade to Team's and Manage billing's writes, which leave for Stripe.
  {
    path: "product/settings/billing/checkout-opening",
    family: "settings",
    screen: "billing",
    name: "checkout-opening",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/billing/portal-opening",
    family: "settings",
    screen: "billing",
    name: "portal-opening",
    states: ["default"],
    pending: true,
  },
] as const satisfies readonly ProductSituation[];
