import { productStates } from "../product-families";
import type { ProductSituation } from "../product-situation";

export const onboardingSituations = [
  {
    path: "product/account/invitation-accept/expired",
    family: "account",
    screen: "invitation-accept",
    name: "expired",
    states: ["default"],
  },
  {
    path: "product/account/invitation-accept/open-error",
    family: "account",
    screen: "invitation-accept",
    name: "open-error",
    states: ["default"],
  },
  {
    path: "product/account/create-workspace/slug",
    family: "account",
    screen: "create-workspace",
    name: "slug",
    states: ["default", "empty", "error"],
  },
  {
    path: "product/account/create-workspace/suggestion-loading",
    family: "account",
    screen: "create-workspace",
    name: "suggestion-loading",
    states: ["default"],
  },
  // The step's loading drawing is its session read, and its page already
  // draws five, so Create workspace's write is a screen beside it.
  {
    path: "product/account/create-workspace/creating",
    family: "account",
    screen: "create-workspace",
    name: "creating",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/choose-repository/slug-taken",
    family: "account",
    screen: "choose-repository",
    name: "slug-taken",
    states: ["default", "empty"],
  },
  {
    path: "product/account/choose-repository/suggestion-loading",
    family: "account",
    screen: "choose-repository",
    name: "suggestion-loading",
    states: ["default"],
  },
  // The select open and the workspace with one account are screens beside the
  // step, so the pending address keeps its place among the step's variants.
  {
    path: "product/account/choose-repository/open",
    family: "account",
    screen: "choose-repository",
    name: "open",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/account/choose-repository/one-account",
    family: "account",
    screen: "choose-repository",
    name: "one-account",
    sibling: true,
    states: ["default"],
  },
  // Create project's write is a screen beside the step for the same reason.
  {
    path: "product/account/choose-repository/creating",
    family: "account",
    screen: "choose-repository",
    name: "creating",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/choose-repository/cli",
    family: "account",
    screen: "choose-repository",
    name: "cli",
    states: productStates,
  },
  // The CLI form's loading drawing is its write, so its workspace read is the
  // form's fifth drawing.
  {
    path: "product/account/choose-repository/cli/workspace-loading",
    family: "account",
    screen: "choose-repository",
    name: "workspace-loading",
    parent: "product/account/choose-repository/cli",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/install-app/member",
    family: "account",
    screen: "install-app",
    name: "member",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/account/install-app/reviewer",
    family: "account",
    screen: "install-app",
    name: "reviewer",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/account/install-app/suspended-unreadable",
    family: "account",
    screen: "install-app",
    name: "suspended-unreadable",
    sibling: true,
    states: ["default"],
  },
  // The install step in the desktop app's window, whose Install on GitHub
  // opens the web. The step's other single drawings are declared siblings, so
  // this one is its fourth variant.
  {
    path: "product/account/install-app/desktop",
    family: "account",
    screen: "install-app",
    name: "desktop",
    states: ["default"],
  },
  {
    path: "product/account/install-app/suspended-loading",
    family: "account",
    screen: "install-app",
    name: "suspended-loading",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/account/install-app/installing",
    family: "account",
    screen: "install-app",
    name: "installing",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/install-app/connect",
    family: "account",
    screen: "install-app",
    name: "connect",
    states: productStates,
  },
  {
    path: "product/account/install-app/connect/named-workspace",
    family: "account",
    screen: "install-app",
    name: "named-workspace",
    parent: "product/account/install-app/connect",
    states: ["default"],
  },
  // The select open is a screen beside the step, in its folder, as the
  // repository step's is.
  {
    path: "product/account/install-app/connect/open",
    family: "account",
    screen: "install-app",
    name: "open",
    parent: "product/account/install-app/connect",
    sibling: true,
    states: ["default"],
  },
  // Continue on GitHub's write: the connect situation already draws five, so
  // its write is a screen beside it, in its folder.
  {
    path: "product/account/install-app/connect/connecting",
    family: "account",
    screen: "install-app",
    name: "connecting",
    parent: "product/account/install-app/connect",
    sibling: true,
    states: ["default"],
    pending: true,
  },
] as const satisfies readonly ProductSituation[];
