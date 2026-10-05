/** An address in the accepted catalogue, including a removed record's address. */
export type CurrentPath = string & { readonly __moklyPathSide: "current" };

/** A reference to an identity at the branch point, with its original spelling. */
export type BranchPointPath = string & {
  readonly __moklyPathSide: "branch-point";
};

/** The reference type associated with a typed or raw current inventory. */
export type BeforePath<Path extends string> = string extends Path
  ? string
  : BranchPointPath;
