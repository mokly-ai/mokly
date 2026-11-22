import type { ProductSituation } from "../product-situation";

export const publishingSituations = [
  {
    path: "product/viewer/standalone/publish",
    family: "viewer",
    screen: "standalone",
    name: "publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish/pull-request",
    family: "viewer",
    screen: "standalone",
    name: "pull-request",
    parent: "product/viewer/standalone/publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish/reader",
    family: "viewer",
    screen: "standalone",
    name: "reader",
    parent: "product/viewer/standalone/publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish/publishing",
    family: "viewer",
    screen: "standalone",
    name: "publishing",
    parent: "product/viewer/standalone/publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish/reader-pull-request",
    family: "viewer",
    screen: "standalone",
    name: "reader-pull-request",
    parent: "product/viewer/standalone/publish",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish-refused",
    family: "viewer",
    screen: "standalone",
    name: "publish-refused",
    states: ["default"],
  },
  {
    path: "product/viewer/standalone/publish-refused/pull-request",
    family: "viewer",
    screen: "standalone",
    name: "pull-request",
    parent: "product/viewer/standalone/publish-refused",
    states: ["default"],
  },
  // Publish this branch while its build request runs, a screen beside the
  // publishing card, which already draws four variants.
  {
    path: "product/viewer/standalone/publish-busy",
    family: "viewer",
    screen: "standalone",
    name: "publish-busy",
    states: ["default"],
    pending: true,
  },
  {
    path: "product/viewer/standalone/mac-app",
    family: "viewer",
    screen: "standalone",
    name: "mac-app",
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/publishing",
    family: "viewer",
    screen: "pull-request",
    name: "publishing",
    states: ["default"],
  },
] as const satisfies readonly ProductSituation[];
