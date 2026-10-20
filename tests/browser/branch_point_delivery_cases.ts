/**
 * What the copied files of each shared branch-point case render. The shared
 * set in `tests/fixtures/branch_point_cases.json` holds each case's moves and
 * each removed record's path and stored parent title. This module keeps what
 * only the copied files show: the selectors and texts of each case, the
 * current paths that render them, and the base path of each case-only
 * rename, which no move holds.
 */

import {
  branchPointCases,
  branchPointPaths as paths,
} from "../helpers/branch_point_sources.js";

/** One entry whose base and head documents the delivery spec reads. */
export interface DeliveryPair {
  /** The entry's path at the base commit. */
  before: string;
  /** The entry's path at the head commit. */
  after: string;
  selector: string;
  text: readonly [string, string];
  /** The case's moves pair the head path with the base path. */
  moved: boolean;
  asset?: true;
}

/** A removed record of a shared case, and the text that its button shows. */
export interface DeliveryRemoved {
  path: string;
  parentTitle: string;
  text: string;
}

/**
 * The written facts of one pair. The case's moves give a moved pair its base
 * path, so a pair writes `before` only for a case-only rename.
 */
interface PairFacts extends Omit<DeliveryPair, "before" | "moved"> {
  /** The base path of a case-only rename, which no move of the case holds. */
  before?: string;
}

/**
 * The copied facts of one case: what its pairs render, the component whose
 * detail lists the affected consumers, a reused document path, and the
 * button text of its removed record.
 */
interface DeliveryFacts {
  /** The case title that ends each test name. */
  name: string;
  pairs: PairFacts[];
  affectedComponent?: string;
  /**
   * A path that held a component at the base commit and holds a document in
   * the head commit, so the index lists it only as a document.
   */
  document?: string;
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
        after: paths.movedScreen,
        selector: "span",
        text: ["Before Paid", "After Paid"],
        asset: true,
      },
      {
        after: paths.movedConsumer,
        selector: "span",
        text: ["Before Active", "After Active"],
        asset: true,
      },
    ],
  },
  "moved-parent": {
    name: "moved component parent and removed sibling",
    pairs: [
      {
        after: paths.movedParent,
        selector: "button",
        text: ["Action", "Action"],
      },
      {
        after: paths.movedChild,
        selector: "button",
        text: ["Continue", "Submit"],
      },
    ],
    removedText: "Cancel",
  },
  "moved-variant": {
    name: "variant transferred between surviving parents",
    pairs: [
      {
        after: paths.movedVariant,
        selector: "button",
        text: ["Continue", "Submit"],
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
      },
      {
        before: "branch/case/Receipt",
        after: paths.caseScreen,
        selector: "h1",
        text: ["Case receipt", "Case receipt"],
      },
      {
        before: "branch/case/Action/Primary",
        after: paths.caseVariant,
        selector: "button",
        text: ["Continue", "Submit"],
      },
    ],
    removedText: "Cancel",
  },
  "reused-parent": {
    name: "document reusing a removed component path",
    pairs: [],
    document: paths.reusedParent,
    removedText: "Go",
  },
};

/**
 * One pair with its base path: a move of the case gives it, or the pair
 * writes it for a case-only rename. A pair with both, or with neither, stops
 * the spec from loading, so the moves stay the only source of a moved pair.
 */
function deliveryPair(
  name: string,
  moves: Readonly<Record<string, string>>,
  { before: written, ...pair }: PairFacts,
): DeliveryPair {
  const previous = moves[pair.after];
  if (previous !== undefined && written !== undefined)
    throw new Error(
      `The case ${name} moves ${pair.after}, so its pair writes no before path`,
    );
  const before = previous ?? written;
  if (before === undefined)
    throw new Error(
      `The case ${name} has no move or before path for ${pair.after}`,
    );
  return { ...pair, before, moved: previous !== undefined };
}

/**
 * Each case of `tests/fixtures/branch_point_cases.json` with its copied
 * facts, the base path of each pair, and its removed record. A case without
 * facts, facts without a case, or a removed record without a button text
 * stops the spec from loading, so the delivery checks cover every shared
 * case.
 */
export const branchPointDeliveryCases = branchPointCases.map(
  ({ name, moves, removed }) => {
    const facts = FACTS[name];
    if (!facts) throw new Error(`No delivery facts for the case ${name}`);
    const { pairs, removedText, ...rest } = facts;
    const [record, ...more] = Object.entries(removed);
    if (
      more.length > 0 ||
      (record === undefined) !== (removedText === undefined)
    )
      throw new Error(
        `The case ${name} needs one button text per removed record`,
      );
    const recorded: DeliveryRemoved | undefined =
      record && removedText !== undefined
        ? { path: record[0], parentTitle: record[1], text: removedText }
        : undefined;
    return {
      ...rest,
      pairs: pairs.map((pair) => deliveryPair(name, moves, pair)),
      removed: recorded,
    };
  },
);
if (branchPointDeliveryCases.length !== Object.keys(FACTS).length)
  throw new Error("Delivery facts name a case that the shared set lacks");
