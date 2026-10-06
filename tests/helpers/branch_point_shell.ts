/** Served and public shell inputs for one shared branch-point fixture case. */

import { projectCatalogue } from "../../packages/mokly/src/catalogue/projection.js";
import { computeCatalogueChanges } from "../../packages/mokly/src/server/changed.js";
import { readShellCatalogue } from "../../packages/viewer/src/catalogue/reader.js";
import {
  createCatalogue,
  type Catalogue,
  type CatalogueManifestEntry,
} from "../../packages/viewer/src/shell/catalogue.js";
import type { ShellContext } from "../../packages/viewer/src/shell/context.js";
import type { WorkspaceEntry } from "../../packages/viewer/src/shell/workspace_entry.js";
import {
  viewerCatalogue,
  viewerContext,
} from "../../packages/viewer/src/viewer/projection.js";
import { defaultSelection } from "../../packages/viewer/src/viewer/selection.js";
import type { ViewerSelection } from "../../packages/viewer/src/viewer/types.js";

import { branchPointFixture } from "./branch_point_fixture.js";
import type { BranchPointCase } from "./branch_point_sources.js";

/** One shell's catalogue and the context it gives a routed entry. */
export interface BranchPointShellSide {
  name: "served" | "public";
  catalogue: Catalogue;
  context(
    entry?: CatalogueManifestEntry,
    selection?: Partial<ViewerSelection>,
  ): ShellContext;
}

/** Both shells of one case, and the fixture cleanup the caller owns. */
export interface BranchPointShell {
  remove(): Promise<void>;
  sides: readonly [BranchPointShellSide, BranchPointShellSide];
}

/**
 * Build the served catalogue as Serve and export do, and the public catalogue
 * the hydrated and embedded shells read from the projected model.
 */
export async function branchPointShell(
  name: BranchPointCase,
): Promise<BranchPointShell> {
  const fixture = await branchPointFixture(name);
  try {
    const { after, config, git } = fixture;
    const changes = await computeCatalogueChanges(
      config,
      "main",
      git,
      after.manifest,
    );
    const catalogue = createCatalogue(
      after.manifest,
      changes.removedEntries,
      changes.movedEntries,
    );
    const model = readShellCatalogue(
      projectCatalogue({
        catalogue,
        configPath: "mokly.config.ts",
        changesStatus: "ready",
        changedEntries: changes.changedEntries,
        evidence: changes.componentChanges,
        comparisonUrl: null,
        revision: { content: 0, evidence: 0 },
      }),
    );
    const publicCatalogue = viewerCatalogue(model);
    const snapshot = (side: Catalogue, entry?: CatalogueManifestEntry) =>
      side.removedEntries.find((record) => record.entry === entry)?.snapshotId;
    return {
      remove: fixture.fixture.remove,
      sides: [
        {
          name: "served",
          catalogue,
          context: (entry) => {
            const snapshotId = snapshot(catalogue, entry);
            return {
              base: "main",
              changedEntries: changes.changedEntries,
              ...(changes.componentChanges
                ? { componentChanges: changes.componentChanges }
                : {}),
              updateVersion: 0,
              ...(entry ? { activeId: entry.path } : {}),
              ...(snapshotId ? { snapshotId } : {}),
            };
          },
        },
        {
          name: "public",
          catalogue: publicCatalogue,
          context: (entry, selection = {}) => {
            const snapshotId = snapshot(publicCatalogue, entry);
            return viewerContext(model, {
              ...defaultSelection,
              ...selection,
              screenPath: entry?.path ?? null,
              ...(snapshotId ? { snapshotId } : {}),
            });
          },
        },
      ],
    };
  } catch (error) {
    await fixture.fixture.remove();
    throw error;
  }
}

/** The routed current or removed entry at one exact path. */
export function routedEntry(
  side: BranchPointShellSide,
  path: string,
): WorkspaceEntry {
  const entry = side.catalogue.byPath.get(path);
  if (entry?.kind !== "component" && entry?.kind !== "screen")
    throw new Error(`Missing ${side.name} entry ${path}`);
  return entry;
}
