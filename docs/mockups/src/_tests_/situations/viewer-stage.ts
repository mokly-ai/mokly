import type { ProductSituation } from "../product-situation";

export const viewerStageSituations = [
  {
    path: "product/viewer/standalone/reader",
    family: "viewer",
    screen: "standalone",
    name: "reader",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/version",
    family: "viewer",
    screen: "standalone",
    name: "version",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/unreadable",
    family: "viewer",
    screen: "standalone",
    name: "unreadable",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/account",
    family: "viewer",
    screen: "standalone",
    name: "account",
    states: ["default"],
  },
  // The account menu open under the avatar, and More open in its place on a
  // narrow bar and on a phone.
  {
    path: "product/viewer/standalone/account-menu",
    family: "viewer",
    screen: "standalone",
    name: "account-menu",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/failed",
    family: "viewer",
    screen: "standalone",
    name: "failed",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/latest",
    family: "viewer",
    screen: "standalone",
    name: "latest",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/plan",
    family: "viewer",
    screen: "standalone",
    name: "plan",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/plan-reader",
    family: "viewer",
    screen: "standalone",
    name: "plan-reader",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/workspace-unreadable",
    family: "viewer",
    screen: "standalone",
    name: "workspace-unreadable",
    states: ["default"],
  },
  // The viewer's waits that are situations of their own: the route's project
  // read, whose bar's controls wait disabled, the read of a publication's
  // address, whose reference trigger waits as a placeholder, the workspace
  // read that decides the Team card, and a publication that CI still uploads.
  {
    path: "product/viewer/standalone/project-loading",
    family: "viewer",
    screen: "standalone",
    name: "project-loading",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/viewer/standalone/publication-loading",
    family: "viewer",
    screen: "standalone",
    name: "publication-loading",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/plan-loading",
    family: "viewer",
    screen: "standalone",
    name: "plan-loading",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/uploading",
    family: "viewer",
    screen: "standalone",
    name: "uploading",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/catalogue",
    family: "viewer",
    screen: "standalone",
    name: "catalogue",
    states: ["default", "loading", "error"],
  },
  {
    path: "product/viewer/standalone/catalogue/comparison",
    family: "viewer",
    screen: "standalone",
    name: "comparison",
    parent: "product/viewer/standalone/catalogue",
    states: ["default"],
  },
] as const satisfies readonly ProductSituation[];
