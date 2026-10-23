import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { repositoryRoot } from "./fixture.js";
import { write } from "./static_changes.js";

/** One case of the shared set in `tests/fixtures/branch_point_cases.json`. */
export interface BranchPointCase {
  name: string;
  /** The case's files at the base commit. */
  base: Record<string, string>;
  /** The head commit's changes: new text, or `null` for a removed file. */
  head: Record<string, string | null>;
  /** Each paired entry's current path, mapped to its previous path. */
  moves: Record<string, string>;
  /** Each removed record's path, mapped to its stored parent title. */
  removed: Record<string, string>;
  /** The affected consumer paths, in review order. */
  affected: string[];
}

/**
 * The branch-point lookup contract's five cases and the affected destinations
 * of user decision 103 C, one shared set of real Git base commits. The Rust comparison tests run each case in its own
 * repository; the browser fixtures write every case into both commits of
 * their catalogue, so Serve, the branch copy, and the embedded viewer show
 * the same sources.
 */
export const branchPointCases: readonly BranchPointCase[] = JSON.parse(
  readFileSync(
    path.join(repositoryRoot, "tests/fixtures/branch_point_cases.json"),
    "utf8",
  ),
);

/** Add the shared cases to either the copied delivery fixture or watched Serve. */
export const addBranchPointSources: ComparisonAdditions = async (
  root,
  side,
) => {
  if (side === "Before") {
    const configuration = JSON.parse(
      await fs.readFile(path.join(root, "mokly.config.json"), "utf8"),
    );
    // Styles resolve resources from their stylesheet, at every consumer depth.
    // The case renames keep every stylesheet unchanged.
    configuration.stylesheets.unshift(
      { match: "branch/case/**/*.html", stylesheets: [] },
      {
        match: "branch/consumers/**/*.html",
        stylesheets: ["theme.css", "branch-assets.css"],
      },
    );
    await write(root, "mokly.config.json", JSON.stringify(configuration));
    for (const { base } of branchPointCases)
      for (const [name, contents] of Object.entries(base))
        await write(root, name, contents);
    return;
  }
  // Removals come first, so a case-only rename also works where file names
  // ignore case.
  for (const { head } of branchPointCases)
    for (const [name, contents] of Object.entries(head))
      if (contents === null) await fs.rm(path.join(root, name));
  for (const { head } of branchPointCases)
    for (const [name, contents] of Object.entries(head))
      if (contents !== null) await write(root, name, contents);
};

/** Stable paths shared by delivery checks and the viewer's Serve journeys. */
export const branchPointPaths = {
  movedScreen: "branch/consumers/archive/receipt",
  previousScreen: "branch/consumers/receipt",
  movedConsumer: "branch/consumers/archive/status/default",
  previousConsumer: "branch/consumers/status/default",
  parentFolder: "branch/parent",
  movedParent: "branch/parent/archive/action",
  movedChild: "branch/parent/archive/action/primary",
  previousChild: "branch/parent/action/primary",
  removedChild: "branch/parent/action/secondary",
  movedVariant: "branch/variant/receiver/primary",
  previousVariant: "branch/variant/donor/primary",
  caseScreen: "branch/case/receipt",
  caseParent: "branch/case/action",
  caseVariant: "branch/case/action/primary",
  caseRemoved: "branch/case/Action/secondary",
  reusedParent: "branch/reused/action",
  reusedRemoved: "branch/reused/action/default",
  /** Tally changes, with Unmodified consumers and an Added consumer. */
  impactComponent: "branch/impact/tally",
  /** Out of Changes: Meter and its variant. */
  impactParent: "branch/impact/meter",
  impactVariant: "branch/impact/meter/default",
  /** In Changes as a pure move. */
  impactMoved: "branch/impact/archive/slip",
  impactPrevious: "branch/impact/slip",
  /** In Changes for its desktop view; its mobile view stays unchanged. */
  impactLedger: "branch/impact/ledger",
  /** Added consumer with no base side. */
  impactAdded: "branch/impact/new",
} as const;
