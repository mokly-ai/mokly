/** Published catalogues of plain screens, built through the index reader. */

import { createHash } from "node:crypto";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type { ShellCatalogueReadModel } from "../src/catalogue/scoped_types.js";
import { shellCatalogueModel } from "../src/catalogue/shell_model.js";
import type {
  CatalogueNode,
  CatalogueScreen,
  RemovedEntry,
} from "../src/catalogue/types.js";

import { rawIndexFixture } from "./catalogue_v7_fixture.js";

/** The Changes state of one published screen. */
export type ScreenChange = "changed" | "removed" | "unmodified";

/** A stable 64-digit hash for a test identity. */
function hash(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

/**
 * One screen record with a light mobile and desktop view. Changes includes a
 * changed or removed screen, and only a changed one offers a comparison.
 */
export function publishedScreen(
  path: string,
  title: string,
  change: ScreenChange = "unmodified",
  variantOf?: string,
): CatalogueScreen {
  return {
    changes: {
      included: change !== "unmodified",
      kind: change,
      status: "ready",
    },
    colorSchemes: ["light"],
    controls: {},
    details: {
      description: title,
      relatedDocs: [],
      sourcePath: `specs/${path}.mockup.tsx`,
    },
    kind: "screen",
    path,
    propSchema: { additionalProperties: false, type: "object" },
    props: {},
    tags: [],
    title,
    useCasePaths: [],
    ...(variantOf ? { variantOf } : {}),
    views: (["mobile", "desktop"] as const).map((viewport) => ({
      colorScheme: "light",
      comparison: {
        eligible: change === "changed",
        kind: change,
        status: "ready",
      },
      documentKey: hash(`${path}:${viewport}`),
      viewport,
    })),
  };
}

/** A removed screen variant with its base folder titles and parent title. */
export function removedScreenVariant(
  path: string,
  title: string,
  parent: { path: string; title: string },
  folderTitles: readonly string[],
): RemovedEntry {
  return {
    entry: publishedScreen(path, title, "removed", parent.path),
    folderTitles: [...folderTitles],
    parentTitle: parent.title,
    preview: { kind: "screen" },
    snapshotId: hash(`removed:${path}`),
  };
}

/**
 * The validated shell model of one index that holds only these screens,
 * removed entries, and tree, with Changes ready and no held details.
 */
export function publishedScreensModel(input: {
  screens: readonly CatalogueScreen[];
  removedEntries?: readonly RemovedEntry[];
  tree: readonly CatalogueNode[];
}): ShellCatalogueReadModel {
  const raw = rawIndexFixture();
  raw.components = [];
  raw.documents = [];
  raw.pages = [];
  raw.useCases = [];
  raw.screens = [...input.screens];
  raw.removedEntries = [...(input.removedEntries ?? [])];
  raw.tree = [...input.tree];
  return shellCatalogueModel(readCatalogueIndex(raw), new Map());
}
