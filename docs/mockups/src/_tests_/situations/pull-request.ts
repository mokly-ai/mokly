import type { ProductSituation } from "../product-situation";

export const pullRequestSituations = [
  {
    path: "product/viewer/pull-request/closed",
    family: "viewer",
    screen: "pull-request",
    name: "closed",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/closed/merged",
    family: "viewer",
    screen: "pull-request",
    name: "merged",
    parent: "product/viewer/pull-request/closed",
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/fork",
    family: "viewer",
    screen: "pull-request",
    name: "fork",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/plan",
    family: "viewer",
    screen: "pull-request",
    name: "plan",
    sibling: true,
    states: ["default"],
  },
  {
    path: "product/viewer/pull-request/plan/reader",
    family: "viewer",
    screen: "pull-request",
    name: "reader",
    parent: "product/viewer/pull-request/plan",
    states: ["default"],
  },
] as const satisfies readonly ProductSituation[];
