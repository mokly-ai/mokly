import { branchPointPaths as paths } from "../helpers/branch_point_sources.js";

export interface DeliveryPair {
  before: string;
  after: string;
  selector: string;
  text: readonly [string, string];
  moved: boolean;
  asset?: true;
}

/** References retain each side's spelling, even when a current parent moves. */
export const branchPointCases: readonly {
  name: string;
  pairs: DeliveryPair[];
  affectedComponent?: string;
  removed?: { path: string; parentTitle: string; text: string };
}[] = [
  {
    name: "moved screen and component consumer",
    affectedComponent: "branch/consumers/badge",
    pairs: [
      {
        before: paths.previousScreen,
        after: paths.movedScreen,
        selector: "span",
        text: ["Before Paid", "After Paid"],
        moved: true,
        asset: true,
      },
      {
        before: paths.previousConsumer,
        after: paths.movedConsumer,
        selector: "span",
        text: ["Before Active", "After Active"],
        moved: true,
        asset: true,
      },
    ],
  },
  {
    name: "moved component parent and removed sibling",
    pairs: [
      {
        before: "branch/parent/action",
        after: paths.movedParent,
        selector: "button",
        text: ["Action", "Action"],
        moved: true,
      },
      {
        before: paths.previousChild,
        after: paths.movedChild,
        selector: "button",
        text: ["Continue", "Submit"],
        moved: true,
      },
    ],
    removed: {
      path: paths.removedChild,
      parentTitle: "Action",
      text: "Cancel",
    },
  },
  {
    name: "variant transferred between surviving parents",
    pairs: [
      {
        before: paths.previousVariant,
        after: paths.movedVariant,
        selector: "button",
        text: ["Continue", "Submit"],
        moved: true,
      },
    ],
  },
  {
    name: "case-only screen parent and variant references",
    pairs: [
      {
        before: "branch/case/Action",
        after: paths.caseParent,
        selector: "button",
        text: ["Case action", "Case action"],
        moved: false,
      },
      {
        before: "branch/case/Receipt",
        after: paths.caseScreen,
        selector: "h1",
        text: ["Case receipt", "Case receipt"],
        moved: false,
      },
      {
        before: "branch/case/Action/Primary",
        after: paths.caseVariant,
        selector: "button",
        text: ["Continue", "Submit"],
        moved: false,
      },
    ],
    removed: {
      path: paths.caseRemoved,
      parentTitle: "Case action",
      text: "Cancel",
    },
  },
  {
    name: "document reusing a removed component path",
    pairs: [],
    removed: {
      path: paths.reusedRemoved,
      parentTitle: "Former action",
      text: "Go",
    },
  },
];
