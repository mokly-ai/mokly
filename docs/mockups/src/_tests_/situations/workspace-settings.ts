import { productStates } from "../product-families";
import type { ProductSituation } from "../product-situation";

export const workspaceSettingsSituations = [
  // The Account pane asked for by its address while the settings scope
  // loads, and while the session loads before it, and Connect GitHub's write.
  // The pane's three states leave room for one more drawing only, so each is
  // a screen beside it.
  {
    path: "product/settings/account/scope-loading",
    family: "settings",
    screen: "account",
    name: "scope-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/account/session-loading",
    family: "settings",
    screen: "account",
    name: "session-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/account/github-connecting",
    family: "settings",
    screen: "account",
    name: "github-connecting",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/workspace/suspended",
    family: "settings",
    screen: "workspace",
    name: "suspended",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/absent",
    family: "settings",
    screen: "workspace",
    name: "absent",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/accounts-loading",
    family: "settings",
    screen: "workspace",
    name: "accounts-loading",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/accounts-unreadable",
    family: "settings",
    screen: "workspace",
    name: "accounts-unreadable",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/plan",
    family: "settings",
    screen: "workspace",
    name: "plan",
    states: ["default"],
  },
  {
    path: "product/settings/workspace/plan-member",
    family: "settings",
    screen: "workspace",
    name: "plan-member",
    states: ["default"],
  },
  // The Workspace pane asked for by its address while the settings scope
  // loads, and Save's write.
  {
    path: "product/settings/workspace/scope-loading",
    family: "settings",
    screen: "workspace",
    name: "scope-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/workspace/saving",
    family: "settings",
    screen: "workspace",
    name: "saving",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/workspace/slug",
    family: "settings",
    screen: "workspace",
    name: "slug",
    states: productStates,
  },
  {
    path: "product/settings/github/suspended",
    family: "settings",
    screen: "github",
    name: "suspended",
    states: ["default"],
  },
  {
    path: "product/settings/github/member",
    family: "settings",
    screen: "github",
    name: "member",
    states: ["default"],
  },
  {
    path: "product/settings/github/menu",
    family: "settings",
    screen: "github",
    name: "menu",
    states: ["default"],
    overlay: true,
  },
  {
    path: "product/settings/github/remove",
    family: "settings",
    screen: "github",
    name: "remove",
    states: ["default", "loading"],
    overlay: true,
  },
  // Add GitHub account's write, which leaves for GitHub.
  {
    path: "product/settings/github/adding",
    family: "settings",
    screen: "github",
    name: "adding",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/settings/workspace/slug-recovery",
    family: "settings",
    screen: "workspace",
    name: "recovery",
    parent: "product/settings/workspace/slug",
    states: ["default", "error"],
  },
] as const satisfies readonly ProductSituation[];
