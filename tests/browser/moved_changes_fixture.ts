import fs from "node:fs/promises";
import path from "node:path";

import {
  branchCatalogue,
  startBranchHost,
  type BranchHost,
  type BranchHostKind,
} from "./branch_hosts.js";
import { BASELINE, MOVED_EDITS } from "./moved_changes_sources.js";

/** Where the moved catalogue runs: Serve, a static export, or an embedded viewer over that export. */
export type MovedHostKind = BranchHostKind;

/** A running moved catalogue and how a test opens one of its entries. */
export type MovedChangesHost = BranchHost;

/**
 * Commit the baseline from `moved_changes_sources.ts`, then move `billing`
 * under `account` and rename `components` to `ui`, and apply the branch's
 * edits there.
 */
function movedCatalogue() {
  return branchCatalogue(
    BASELINE,
    '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light"]}',
    async (fixture) => {
      const specs = path.join(fixture.root, "specs");
      await fs.mkdir(path.join(specs, "account"));
      await fs.rename(
        path.join(specs, "billing"),
        path.join(specs, "account/billing"),
      );
      await fs.rename(path.join(specs, "components"), path.join(specs, "ui"));
      for (const [file, source] of Object.entries(MOVED_EDITS))
        await fixture.write(file, source);
    },
  );
}

/** Start the moved catalogue on one kind of host. */
export function startMovedHost(kind: MovedHostKind): Promise<MovedChangesHost> {
  return startBranchHost(kind, movedCatalogue);
}
