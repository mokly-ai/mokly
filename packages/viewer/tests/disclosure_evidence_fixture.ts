/** Shell states and publications around Home's retained Removed variant. */

import assert from "node:assert/strict";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type {
  CatalogueNode,
  CatalogueReadModel,
} from "../src/catalogue/types.js";
import type { Catalogue } from "../src/shell/catalogue.js";
import {
  initialSnapshot,
  shellStateWithCatalogue,
  withIndex,
  type ShellDataSnapshot,
} from "../src/shell/data_commit.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import type { ShellState } from "../src/shell/store_state.js";
import { viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import { indexFixture, rawIndexFixture } from "./catalogue_v8_fixture.js";

/** Disclosure identity introduced only by the retained Removed variant. */
export const variantKey = "variants:product/browse/home";

function stripVariant(node: CatalogueNode): CatalogueNode {
  if (node.kind === "entry" && node.path === "product/browse/home")
    return { kind: "entry", path: node.path };
  if (node.kind === "folder")
    return { ...node, children: node.children.map(stripVariant) };
  return node;
}

/** Valid public index whose Home screen has no current variants. */
export function baseModel(): CatalogueReadModel {
  return indexFixture((index) => {
    index.screens = index.screens.filter(
      (entry) => entry.variantOf === undefined,
    );
    index.removedEntries = [];
    index.tree = index.tree.map(stripVariant);
  });
}

/** Publish Home's former variant only as a retained historical row. */
export function withRemovedVariant(
  model: CatalogueReadModel,
  revision: number,
): CatalogueReadModel {
  const fixture = rawIndexFixture();
  const variant = fixture.screens.find(
    (entry) => entry.variantOf === "product/browse/home",
  );
  assert.ok(variant);
  return readCatalogueIndex({
    ...structuredClone(model),
    revision,
    removedEntries: [
      {
        folderTitles: ["Product", "Browse"],
        parentTitle: fixture.screens.find(
          (entry) => entry.path === variant.variantOf,
        )!.title,
        entry: {
          ...variant,
          changes: { status: "ready", kind: "removed", included: true },
        },
        snapshotId: "f".repeat(64),
        preview: { kind: "screen" },
      },
    ],
  });
}

/** The same index content, published again at a later revision. */
export function republished(
  model: CatalogueReadModel,
  revision: number,
): CatalogueReadModel {
  return readCatalogueIndex({ ...structuredClone(model), revision });
}

/** The shell catalogue of an index before the shell holds any detail. */
export function shellCatalogue(model: CatalogueReadModel): Catalogue {
  return initialSnapshot(model).catalogue;
}

/**
 * Adopt a later publication as the shell's data store does: the snapshot
 * takes the new index, then the state rebinds to its catalogue.
 */
export function publish(
  snapshot: ShellDataSnapshot,
  state: ShellState,
  index: CatalogueReadModel,
): { snapshot: ShellDataSnapshot; state: ShellState } {
  const next = withIndex(snapshot, index, []);
  return {
    snapshot: next,
    state: shellStateWithCatalogue(state, next.catalogue),
  };
}

/** Initialize an isolated shell at either Home or the catalogue root. */
export function initialState(
  model: CatalogueReadModel,
  route: string,
): ShellState {
  const catalogue = shellCatalogue(model);
  const selected = route === "/" ? null : "product/browse/home";
  return createInitialShellState(
    catalogue,
    viewerContext(catalogue.publicModel, {
      ...defaultSelection,
      screenPath: selected,
    }),
    routeFromUrl(catalogue, new URL(`https://example.test${route}`)),
    undefined,
  );
}
