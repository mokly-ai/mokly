/**
 * What the copied files of each shared branch-point case render. The shared
 * set in `tests/fixtures/branch_point_cases.json` holds each removed record's
 * path and stored parent title, so this module keeps only the selectors and
 * texts of each case, with the paths of the pairs that render them.
 */

import {
  branchPointCases,
  branchPointPaths as paths,
} from "../helpers/branch_point_sources.js";

export interface DeliveryPair {
  before: string;
  after: string;
  selector: string;
  text: readonly [string, string];
  moved: boolean;
  asset?: true;
}

/** A removed record of a shared case, and the text that its button shows. */
export interface DeliveryRemoved {
  path: string;
  parentTitle: string;
  text: string;
}

/** The copied facts of one case that the shared set does not hold. */
interface DeliveryFacts {
  /** The case title that ends each test name. */
  name: string;
  pairs: DeliveryPair[];
  affectedComponent?: string;
  /** The button text of the case's removed record, when it has one. */
  removedText?: string;
}

/** References retain each side's spelling, even when a current parent moves. */
const FACTS: Readonly<Record<string, DeliveryFacts>> = {
  "moved-consumers": {
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
  "moved-parent": {
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
    removedText: "Cancel",
  },
  "moved-variant": {
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
  "case-renames": {
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
    removedText: "Cancel",
  },
  "reused-parent": {
    name: "document reusing a removed component path",
    pairs: [],
    removedText: "Go",
  },
};

/**
 * Each case of `tests/fixtures/branch_point_cases.json` with its copied
 * facts, its removed record, and its shared case name. A case without facts,
 * facts without a case, or a removed record without a button text stops the
 * spec from loading, so the delivery checks cover every shared case.
 */
export const branchPointDeliveryCases = branchPointCases.map(
  ({ name, removed }) => {
    if (!FACTS[name]) throw new Error(`No delivery facts for the case ${name}`);
    const { removedText, ...facts } = FACTS[name];
    const [record, ...more] = Object.entries(removed);
    if (
      more.length > 0 ||
      (record === undefined) !== (removedText === undefined)
    )
      throw new Error(
        `The case ${name} needs one button text per removed record`,
      );
    const recorded: DeliveryRemoved | undefined = record && {
      path: record[0],
      parentTitle: record[1],
      text: removedText!,
    };
    return { ...facts, case: name, removed: recorded };
  },
);
if (branchPointDeliveryCases.length !== Object.keys(FACTS).length)
  throw new Error("Delivery facts name a case that the shared set lacks");
